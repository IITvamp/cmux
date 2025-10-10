import { randomUUID } from "node:crypto";

import type { MorphInstance } from "./git";
import { maskSensitive, singleQuote } from "./shell";

const CMUX_RUNTIME_DIR = "/var/tmp/cmux-scripts";

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

type PreparedScript = {
  scriptPath: string | null;
  error: string | null;
};

async function writeScriptFile({
  instance,
  script,
  targetPath,
}: {
  instance: MorphInstance;
  script: string;
  targetPath: string;
}): Promise<{ success: boolean; stdout?: string; stderr?: string }> {
  const command = `
set -euo pipefail
${buildScriptFileCommand(targetPath, script)}
`;

  const result = await instance.exec(`bash -lc ${singleQuote(command)}`);
  if (result.exit_code !== 0) {
    return { success: false, stdout: result.stdout, stderr: result.stderr };
  }
  return { success: true, stdout: result.stdout, stderr: result.stderr };
}

export async function prepareMaintenanceScript({
  instance,
  script,
}: {
  instance: MorphInstance;
  script: string;
}): Promise<PreparedScript> {
  const maintenanceScriptPath = `${CMUX_RUNTIME_DIR}/maintenance-${randomUUID().replace(/-/g, "")}.sh`;

  try {
    const result = await writeScriptFile({
      instance,
      script,
      targetPath: maintenanceScriptPath,
    });

    if (!result.success) {
      const stderrPreview = previewOutput(result.stderr, 2000);
      const stdoutPreview = previewOutput(result.stdout, 500);
      const parts = [
        `Failed to prepare maintenance script`,
        stderrPreview ? `stderr: ${stderrPreview}` : null,
        stdoutPreview ? `stdout: ${stdoutPreview}` : null,
      ].filter((part): part is string => part !== null);
      return { scriptPath: null, error: parts.join(" | ") };
    }

    return { scriptPath: maintenanceScriptPath, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      scriptPath: null,
      error: `Failed to prepare maintenance script: ${message}`,
    };
  }
}

export async function prepareDevScript({
  instance,
  script,
}: {
  instance: MorphInstance;
  script: string;
}): Promise<PreparedScript> {
  const devScriptPath = `${CMUX_RUNTIME_DIR}/dev-${randomUUID().replace(/-/g, "")}.sh`;

  try {
    const result = await writeScriptFile({
      instance,
      script,
      targetPath: devScriptPath,
    });

    if (!result.success) {
      const stderrPreview = previewOutput(result.stderr, 2000);
      const stdoutPreview = previewOutput(result.stdout, 500);
      const parts = [
        `Failed to prepare dev script`,
        stderrPreview ? `stderr: ${stderrPreview}` : null,
        stdoutPreview ? `stdout: ${stdoutPreview}` : null,
      ].filter((part): part is string => part !== null);
      return { scriptPath: null, error: parts.join(" | ") };
    }

    return { scriptPath: devScriptPath, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      scriptPath: null,
      error: `Failed to prepare dev script: ${message}`,
    };
  }
}
