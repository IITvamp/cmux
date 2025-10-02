import type { MorphInstance } from "./git";
import { maskSensitive, singleQuote } from "./shell";

const WORKSPACE_ROOT = "/root/workspace" as const;
const CMUX_RUNTIME_DIR = `${WORKSPACE_ROOT}/.cmux` as const;
const LOG_DIR = "/var/log/cmux" as const;

const sanitizeScript = (script: string): string | null => {
  const trimmed = script.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const previewOutput = (value: string | undefined, maxLength = 2000): string | null => {
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

const handleExecFailure = ({
  context,
  exitCode,
  stdout,
  stderr,
}: {
  context: string;
  exitCode: number;
  stdout?: string;
  stderr?: string;
}): never => {
  const stderrPreview = previewOutput(stderr, 2000);
  const stdoutPreview = previewOutput(stdout, 500);
  const messageParts = [
    `${context} failed with exit code ${exitCode}`,
    stderrPreview ? `stderr: ${stderrPreview}` : null,
    stdoutPreview ? `stdout: ${stdoutPreview}` : null,
  ].filter((part): part is string => part !== null);
  throw new Error(messageParts.join(" | "));
};

export const runMaintenanceScript = async (
  instance: MorphInstance,
  script: string
): Promise<void> => {
  const sanitized = sanitizeScript(script);
  if (!sanitized) {
    return;
  }

  const maintenanceScriptPath = `${CMUX_RUNTIME_DIR}/maintenance-script.sh`;
  const command = `
set -euo pipefail
${buildScriptFileCommand(maintenanceScriptPath, sanitized)}
cd ${WORKSPACE_ROOT}
bash -eu -o pipefail ${maintenanceScriptPath}
`;

  const result = await instance.exec(
    `bash -lc ${singleQuote(command)}`
  );

  if (result.exit_code !== 0) {
    handleExecFailure({
      context: "Maintenance script",
      exitCode: result.exit_code,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }
};

export const startDevScript = async (
  instance: MorphInstance,
  script: string
): Promise<void> => {
  const sanitized = sanitizeScript(script);
  if (!sanitized) {
    return;
  }

  const devScriptPath = `${CMUX_RUNTIME_DIR}/dev-script.sh`;
  const pidFile = `${LOG_DIR}/dev-script.pid`;
  const logFile = `${LOG_DIR}/dev-script.log`;

  const command = `
set -euo pipefail
mkdir -p ${LOG_DIR}
${ensurePidStoppedCommand(pidFile)}
${buildScriptFileCommand(devScriptPath, sanitized)}
cd ${WORKSPACE_ROOT}
nohup bash -eu -o pipefail ${devScriptPath} > ${logFile} 2>&1 &
echo $! > ${pidFile}
`;

  const result = await instance.exec(
    `bash -lc ${singleQuote(command)}`
  );

  if (result.exit_code !== 0) {
    handleExecFailure({
      context: "Dev script",
      exitCode: result.exit_code,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }
};
