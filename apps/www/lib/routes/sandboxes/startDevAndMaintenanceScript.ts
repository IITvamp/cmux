import type { MorphInstance } from "./git";
import { maskSensitive, singleQuote } from "./shell";

const CMUX_RUNTIME_DIR = "/var/tmp/cmux-scripts";
const DEV_SCRIPT_PATH = `${CMUX_RUNTIME_DIR}/dev-script.sh`;
const MAINTENANCE_SCRIPT_PATH = `${CMUX_RUNTIME_DIR}/maintenance-script.sh`;

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

const removeFileCommand = (path: string): string => `
if [ -f ${path} ]; then
  rm -f ${path}
fi
`;

const execAndFormatError = async (
  instance: MorphInstance,
  command: string,
  context: string,
): Promise<{ error: string | null }> => {
  try {
    const result = await instance.exec(`bash -lc ${singleQuote(command)}`);
    if (result.exit_code !== 0) {
      const stderrPreview = previewOutput(result.stderr, 2000);
      const stdoutPreview = previewOutput(result.stdout, 500);
      const messageParts = [
        `${context} failed with exit code ${result.exit_code}`,
        stderrPreview ? `stderr: ${stderrPreview}` : null,
        stdoutPreview ? `stdout: ${stdoutPreview}` : null,
      ].filter((part): part is string => part !== null);
      return { error: messageParts.join(" | ") };
    }
    return { error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { error: `${context} execution failed: ${errorMessage}` };
  }
};

export const syncMaintenanceScript = async ({
  instance,
  script,
}: {
  instance: MorphInstance;
  script: string | null;
}): Promise<{ error: string | null }> => {
  const command = script
    ? `set -euo pipefail\n${buildScriptFileCommand(MAINTENANCE_SCRIPT_PATH, script)}`
    : `set -euo pipefail\n${removeFileCommand(MAINTENANCE_SCRIPT_PATH)}`;
  return execAndFormatError(instance, command, "Maintenance script sync");
};

export const syncDevScript = async ({
  instance,
  script,
}: {
  instance: MorphInstance;
  script: string | null;
}): Promise<{ error: string | null }> => {
  const command = script
    ? `set -euo pipefail\n${buildScriptFileCommand(DEV_SCRIPT_PATH, script)}`
    : `set -euo pipefail\n${removeFileCommand(DEV_SCRIPT_PATH)}`;
  return execAndFormatError(instance, command, "Dev script sync");
};

export const DEV_SCRIPT_ABSOLUTE_PATH = DEV_SCRIPT_PATH;
export const MAINTENANCE_SCRIPT_ABSOLUTE_PATH = MAINTENANCE_SCRIPT_PATH;
