import { randomUUID } from "node:crypto";

import type { MorphInstance } from "./git";
import { maskSensitive, singleQuote } from "./shell";

const WORKSPACE_ROOT = "/root/workspace";
const CMUX_RUNTIME_DIR = "/var/tmp/cmux-scripts";
const LOG_DIR = "/var/log/cmux";
const DEFAULT_PATH = "/root/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";
const TMUX_SESSION_NAME = "cmux";
const TMUX_WAIT_ATTEMPTS = 240;
const TMUX_WAIT_SLEEP_SECONDS = 0.5;
const MAINTENANCE_WAIT_TIMEOUT_SECONDS = 600;

const previewOutput = (
  value: string | undefined,
  maxLength = 2500,
): string | null => {
  if (!value) {
    return null;
  }
  const sanitized = maskSensitive(value).trim();
  if (sanitized.length === 0) {
    return null;
  }
  if (sanitized.length <= maxLength) {
    return sanitized;
  }
  return `${sanitized.slice(0, maxLength)}…`;
};

const buildScriptFileCommand = (path: string, contents: string): string => `
mkdir -p ${CMUX_RUNTIME_DIR}
cat <<'CMUX_SCRIPT_EOF' > ${path}
${contents}
CMUX_SCRIPT_EOF
chmod +x ${path}
`;

const waitForTmuxSessionSnippet = (sessionName: string): string => `
ATTEMPT=0
while ! tmux has-session -t ${sessionName} 2>/dev/null; do
  ATTEMPT=$((ATTEMPT + 1))
  if [ "$ATTEMPT" -ge ${TMUX_WAIT_ATTEMPTS} ]; then
    echo "Timed out waiting for tmux session ${sessionName}" >&2
    exit 1
  fi
  sleep ${TMUX_WAIT_SLEEP_SECONDS}
done
`;

const ensurePidStoppedCommand = (pidFile: string): string => `
if [ -f ${pidFile} ]; then
  (
    set -euo pipefail
    trap 'status=$?; echo "Failed to stop process recorded in ${pidFile} (pid \${EXISTING_PID:-unknown}) (exit $status)" >&2' ERR
    EXISTING_PID=$(cat ${pidFile} 2>/dev/null || true)
    if [ -n "\${EXISTING_PID}" ] && kill -0 \${EXISTING_PID} 2>/dev/null; then
      if kill \${EXISTING_PID} 2>/dev/null; then
        sleep 0.2
      elif kill -0 \${EXISTING_PID} 2>/dev/null; then
        echo "Unable to terminate process \${EXISTING_PID}" >&2
        exit 1
      fi

      if kill -0 \${EXISTING_PID} 2>/dev/null; then
        echo "Process \${EXISTING_PID} still running after SIGTERM" >&2
        exit 1
      fi
    fi
  )
fi
`;

export async function runMaintenanceScript({
  instance,
  script,
}: {
  instance: MorphInstance;
  script: string;
}): Promise<{ error: string | null }> {
  const maintenanceRunId = randomUUID().replace(/-/g, "");
  const maintenanceScriptPath = `${CMUX_RUNTIME_DIR}/maintenance-script-${maintenanceRunId}.sh`;
  const maintenanceWrapperPath = `${CMUX_RUNTIME_DIR}/maintenance-wrapper-${maintenanceRunId}.sh`;
  const statusFile = `${CMUX_RUNTIME_DIR}/maintenance-status-${maintenanceRunId}.txt`;
  const logFile = `${LOG_DIR}/maintenance-script.log`;
  const waitName = `maintenance-${maintenanceRunId}`;

  const maintenanceWrapperContent = `
#!/bin/bash
set -euo pipefail
export PATH="${DEFAULT_PATH}"
cd ${WORKSPACE_ROOT}
status=0
trap 'status=$?; printf "%s" "$status" > ${statusFile}; tmux wait-for -S ${waitName}' EXIT
bash -eu -o pipefail ${maintenanceScriptPath} 2>&1 | tee ${logFile}
`.trimStart();

  const command = `
set -euo pipefail
trap 'rm -f ${maintenanceWrapperPath} ${maintenanceScriptPath} ${statusFile}' EXIT
mkdir -p ${LOG_DIR}
${buildScriptFileCommand(maintenanceScriptPath, script)}
${buildScriptFileCommand(maintenanceWrapperPath, maintenanceWrapperContent)}
rm -f ${statusFile}
${waitForTmuxSessionSnippet(TMUX_SESSION_NAME)}
tmux kill-window -t ${TMUX_SESSION_NAME}:maintenance 2>/dev/null || true
tmux new-window -d -t ${TMUX_SESSION_NAME} -n maintenance ${singleQuote(maintenanceWrapperPath)}
if ! timeout ${MAINTENANCE_WAIT_TIMEOUT_SECONDS} tmux wait-for -L ${waitName}; then
  echo "Maintenance script timed out waiting for completion" >&2
  exit 1
fi
status=$(cat ${statusFile} 2>/dev/null || echo 1)
if [ "$status" -ne 0 ]; then
  tail -n 50 ${logFile} >&2 || true
  exit "$status"
fi
`;

  try {
    const result = await instance.exec(`bash -lc ${singleQuote(command)}`);

    if (result.exit_code !== 0) {
      const stderrPreview = previewOutput(result.stderr, 2000);
      const stdoutPreview = previewOutput(result.stdout, 500);
      const messageParts = [
        `Maintenance script failed with exit code ${result.exit_code}`,
        stderrPreview ? `stderr: ${stderrPreview}` : null,
        stdoutPreview ? `stdout: ${stdoutPreview}` : null,
      ].filter((part): part is string => part !== null);
      return { error: messageParts.join(" | ") };
    }

    return { error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { error: `Maintenance script execution failed: ${errorMessage}` };
  }
}

export async function startDevScript({
  instance,
  script,
}: {
  instance: MorphInstance;
  script: string;
}): Promise<{ error: string | null }> {
  const devScriptRunId = randomUUID().replace(/-/g, "");
  const devScriptDir = `${CMUX_RUNTIME_DIR}/${devScriptRunId}`;
  const devScriptPath = `${devScriptDir}/dev-script.sh`;
  const devWrapperPath = `${devScriptDir}/dev-wrapper.sh`;
  const statusFile = `${devScriptDir}/dev-status.txt`;
  const pidFile = `${LOG_DIR}/dev-script.pid`;
  const logFile = `${LOG_DIR}/dev-script.log`;

  const devWrapperContent = `
#!/bin/bash
set -euo pipefail
export PATH="${DEFAULT_PATH}"
cd ${WORKSPACE_ROOT}
rm -f ${statusFile}
trap 'status=$?; printf "%s" "$status" > ${statusFile}' EXIT
printf "%s" "$$" > ${pidFile}
bash -eu -o pipefail ${devScriptPath} 2>&1 | tee -a ${logFile}
`.trimStart();

  const command = `
set -euo pipefail
trap 'rm -f ${devWrapperPath}' EXIT
mkdir -p ${LOG_DIR}
mkdir -p ${devScriptDir}
${ensurePidStoppedCommand(pidFile)}
${buildScriptFileCommand(devScriptPath, script)}
${buildScriptFileCommand(devWrapperPath, devWrapperContent)}
rm -f ${statusFile}
rm -f ${pidFile}
${waitForTmuxSessionSnippet(TMUX_SESSION_NAME)}
tmux kill-window -t ${TMUX_SESSION_NAME}:dev 2>/dev/null || true
tmux new-window -d -t ${TMUX_SESSION_NAME} -n dev ${singleQuote(devWrapperPath)}
start_attempts=40
while [ $start_attempts -gt 0 ]; do
  if [ -s ${pidFile} ]; then
    break
  fi
  if [ -f ${statusFile} ]; then
    break
  fi
  sleep 0.25
  start_attempts=$((start_attempts - 1))
done
if [ ! -s ${pidFile} ]; then
  tmux kill-window -t ${TMUX_SESSION_NAME}:dev 2>/dev/null || true
  status=1
  if [ -f ${statusFile} ]; then
    status=$(cat ${statusFile})
  fi
  tail -n 50 ${logFile} >&2 || true
  exit "$status"
fi
if [ -f ${statusFile} ]; then
  status=$(cat ${statusFile})
  if [ "$status" -ne 0 ]; then
    tmux kill-window -t ${TMUX_SESSION_NAME}:dev 2>/dev/null || true
    tail -n 50 ${logFile} >&2 || true
    exit "$status"
  fi
fi
`;

  try {
    const result = await instance.exec(`bash -lc ${singleQuote(command)}`);

    if (result.exit_code !== 0) {
      const stderrPreview = previewOutput(result.stderr, 2000);
      const stdoutPreview = previewOutput(result.stdout, 500);
      const messageParts = [
        `Dev script failed to start with exit code ${result.exit_code}`,
        stderrPreview ? `stderr: ${stderrPreview}` : null,
        stdoutPreview ? `stdout: ${stdoutPreview}` : null,
      ].filter((part): part is string => part !== null);
      return { error: messageParts.join(" | ") };
    }

    return { error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { error: `Dev script execution failed: ${errorMessage}` };
  }
}
