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

/**
 * Sanitize a string to be used as a tmux session name.
 * Tmux session names cannot contain: periods (.), colons (:), spaces, or other special characters.
 */
const sanitizeTmuxSessionName = (name: string): string => {
  return name.replace(/[.:]/g, "-").replace(/[^a-zA-Z0-9_-]/g, "");
};

const ensureTmuxSessionStoppedCommand = (sessionName: string): string => `
if tmux has-session -t ${sessionName} 2>/dev/null; then
  tmux kill-session -t ${sessionName}
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
  const sessionName = sanitizeTmuxSessionName("cmux-maintenance");
  const logFile = `${LOG_DIR}/maintenance-script.log`;

  const command = `
set -euo pipefail
mkdir -p ${LOG_DIR}
${buildScriptFileCommand(maintenanceScriptPath, script)}
${ensureTmuxSessionStoppedCommand(sessionName)}
cd ${WORKSPACE_ROOT}
tmux new-session -d -s ${sessionName} "bash -eu -o pipefail ${maintenanceScriptPath} 2>&1 | tee ${logFile}; echo \$? > ${logFile}.exit_code"
`;

  try {
    const result = await instance.exec(`bash -lc ${singleQuote(command)}`);

    if (result.exit_code !== 0) {
      const stderrPreview = previewOutput(result.stderr, 2000);
      const stdoutPreview = previewOutput(result.stdout, 500);
      const messageParts = [
        `Failed to start maintenance script with exit code ${result.exit_code}`,
        stderrPreview ? `stderr: ${stderrPreview}` : null,
        stdoutPreview ? `stdout: ${stdoutPreview}` : null,
      ].filter((part): part is string => part !== null);
      return { error: messageParts.join(" | ") };
    }

    // Wait for the tmux session to complete
    const waitCommand = `
max_wait=300
waited=0
while tmux has-session -t ${sessionName} 2>/dev/null; do
  sleep 1
  waited=$((waited + 1))
  if [ \$waited -ge \$max_wait ]; then
    echo "Maintenance script timed out after \${max_wait}s" >&2
    tmux kill-session -t ${sessionName} 2>/dev/null || true
    exit 124
  fi
done

if [ -f ${logFile}.exit_code ]; then
  exit_code=$(cat ${logFile}.exit_code)
  if [ "\$exit_code" != "0" ]; then
    if [ -f ${logFile} ]; then
      tail -n 50 ${logFile}
    fi
    exit \$exit_code
  fi
else
  echo "Maintenance script exit code not found" >&2
  exit 1
fi
`;

    const waitResult = await instance.exec(`bash -c ${singleQuote(waitCommand)}`);

    if (waitResult.exit_code !== 0) {
      const logPreview = previewOutput(waitResult.stdout, 2000);
      const stderrPreview = previewOutput(waitResult.stderr, 500);
      const messageParts = [
        `Maintenance script failed with exit code ${waitResult.exit_code}`,
        logPreview ? `log: ${logPreview}` : null,
        stderrPreview ? `stderr: ${stderrPreview}` : null,
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
  const sessionName = sanitizeTmuxSessionName("cmux-dev");
  const logFile = `${LOG_DIR}/dev-script.log`;

  const command = `
set -euo pipefail
mkdir -p ${LOG_DIR}
mkdir -p ${devScriptDir}
${buildScriptFileCommand(devScriptPath, script)}
${ensureTmuxSessionStoppedCommand(sessionName)}
cd ${WORKSPACE_ROOT}
tmux new-session -d -s ${sessionName} "bash -eu -o pipefail ${devScriptPath} 2>&1 | tee ${logFile}"
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

    // Check if the tmux session started successfully and is still running
    const checkCommand = `
sleep 0.5
if ! tmux has-session -t ${sessionName} 2>/dev/null; then
  if [ -f ${logFile} ]; then
    tail -n 50 ${logFile}
  fi
  echo "Dev script tmux session not found" >&2
  exit 1
fi
`;

    const checkResult = await instance.exec(
      `bash -c ${singleQuote(checkCommand)}`,
    );

    if (checkResult.exit_code !== 0) {
      const logPreview = previewOutput(checkResult.stdout, 2000);
      const stderrPreview = previewOutput(checkResult.stderr, 500);
      const messageParts = [
        "Dev script failed immediately after start",
        logPreview ? `log: ${logPreview}` : null,
        stderrPreview ? `stderr: ${stderrPreview}` : null,
      ].filter((part): part is string => part !== null);
      return { error: messageParts.join(" | ") };
    }

    return { error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { error: `Dev script execution failed: ${errorMessage}` };
  }
}
