import type { MorphInstance } from "./git";
import { maskSensitive, singleQuote } from "./shell";

const WORKSPACE_ROOT = "/root/workspace" as const;
const CMUX_RUNTIME_DIR = `${WORKSPACE_ROOT}/.cmux` as const;
const LOG_DIR = "/var/log/cmux" as const;

const sanitizeScript = (script: string | null | undefined): string | null => {
  if (!script) {
    return null;
  }
  const trimmed = script.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const previewOutput = (
  value: string | undefined,
  maxLength = 2000,
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
  EXISTING_PID=$(cat ${pidFile} 2>/dev/null || true)
  if [ -n "\${EXISTING_PID}" ]; then
    if kill -0 \${EXISTING_PID} 2>/dev/null; then
      kill \${EXISTING_PID} 2>/dev/null || true
      for attempt in 1 2 3 4 5; do
        if kill -0 \${EXISTING_PID} 2>/dev/null; then
          sleep 0.2
        else
          break
        fi
      done
    fi
  fi
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
  const devScriptPath = `${CMUX_RUNTIME_DIR}/dev-script.sh`;
  const pidFile = `${LOG_DIR}/dev-script.pid`;
  const logFile = `${LOG_DIR}/dev-script.log`;

  const command = `
set -euo pipefail
mkdir -p ${LOG_DIR}
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
