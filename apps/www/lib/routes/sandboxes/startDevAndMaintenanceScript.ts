import { randomUUID } from "node:crypto";

import type { MorphInstance } from "./git";
import { maskSensitive, singleQuote } from "./shell";

const WORKSPACE_ROOT = "/root/workspace";
const CMUX_RUNTIME_DIR = "/var/tmp/cmux-scripts";
const LOG_DIR = "/var/log/cmux";

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
  const maintenanceScriptPath = `${CMUX_RUNTIME_DIR}/maintenance-script.sh`;
  const command = `
set -euo pipefail
trap 'rm -f ${maintenanceScriptPath}' EXIT
${buildScriptFileCommand(maintenanceScriptPath, script)}
cd ${WORKSPACE_ROOT}
bash -eu -o pipefail ${maintenanceScriptPath}
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
  const pidFile = `${LOG_DIR}/dev-script.pid`;
  const logFile = `${LOG_DIR}/dev-script.log`;

  const command = `
set -euo pipefail
mkdir -p ${LOG_DIR}
mkdir -p ${devScriptDir}
${ensurePidStoppedCommand(pidFile)}
${buildScriptFileCommand(devScriptPath, script)}
cd ${WORKSPACE_ROOT}
nohup bash -eu -o pipefail ${devScriptPath} > ${logFile} 2>&1 &
echo $! > ${pidFile}
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

    // Check if the process started successfully and is still running
    const checkCommand = `
if [ -f ${pidFile} ]; then
  PID=$(cat ${pidFile} 2>/dev/null || echo "")
  if [ -n "\$PID" ]; then
    sleep 0.5
    if ! kill -0 \$PID 2>/dev/null; then
      if [ -f ${logFile} ]; then
        tail -n 50 ${logFile}
      fi
      exit 1
    fi
  fi
fi
`;

    const checkResult = await instance.exec(
      `bash -c ${singleQuote(checkCommand)}`,
    );

    if (checkResult.exit_code !== 0) {
      const logPreview = previewOutput(checkResult.stdout, 2000);
      return {
        error: `Dev script failed immediately after start${logPreview ? ` | log: ${logPreview}` : ""}`,
      };
    }

    return { error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { error: `Dev script execution failed: ${errorMessage}` };
  }
}

/**
 * Write maintenance script to the instance filesystem without executing it.
 * The script will be executed later on tmux attach.
 */
export async function writeMaintenanceScript({
  instance,
  script,
}: {
  instance: MorphInstance;
  script: string;
}): Promise<{ error: string | null }> {
  const maintenanceScriptPath = `${CMUX_RUNTIME_DIR}/maintenance-script.sh`;
  const command = `
set -euo pipefail
${buildScriptFileCommand(maintenanceScriptPath, script)}
echo "Maintenance script written to ${maintenanceScriptPath}"
`;

  try {
    const result = await instance.exec(`bash -lc ${singleQuote(command)}`);

    if (result.exit_code !== 0) {
      const stderrPreview = previewOutput(result.stderr, 2000);
      const stdoutPreview = previewOutput(result.stdout, 500);
      const messageParts = [
        `Failed to write maintenance script with exit code ${result.exit_code}`,
        stderrPreview ? `stderr: ${stderrPreview}` : null,
        stdoutPreview ? `stdout: ${stdoutPreview}` : null,
      ].filter((part): part is string => part !== null);
      return { error: messageParts.join(" | ") };
    }

    return { error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { error: `Failed to write maintenance script: ${errorMessage}` };
  }
}

/**
 * Write dev script to the instance filesystem without starting it.
 * The script will be started later on tmux attach.
 */
export async function writeDevScript({
  instance,
  script,
}: {
  instance: MorphInstance;
  script: string;
}): Promise<{ error: string | null }> {
  const devScriptRunId = randomUUID().replace(/-/g, "");
  const devScriptDir = `${CMUX_RUNTIME_DIR}/${devScriptRunId}`;
  const devScriptPath = `${devScriptDir}/dev-script.sh`;

  const command = `
set -euo pipefail
mkdir -p ${LOG_DIR}
mkdir -p ${devScriptDir}
${buildScriptFileCommand(devScriptPath, script)}
echo "Dev script written to ${devScriptPath}"
`;

  try {
    const result = await instance.exec(`bash -lc ${singleQuote(command)}`);

    if (result.exit_code !== 0) {
      const stderrPreview = previewOutput(result.stderr, 2000);
      const stdoutPreview = previewOutput(result.stdout, 500);
      const messageParts = [
        `Failed to write dev script with exit code ${result.exit_code}`,
        stderrPreview ? `stderr: ${stderrPreview}` : null,
        stdoutPreview ? `stdout: ${stdoutPreview}` : null,
      ].filter((part): part is string => part !== null);
      return { error: messageParts.join(" | ") };
    }

    return { error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { error: `Failed to write dev script: ${errorMessage}` };
  }
}
