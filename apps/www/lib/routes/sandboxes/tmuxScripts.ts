import { randomUUID } from "node:crypto";

import type { MorphInstance } from "./git";
import { maskSensitive, singleQuote } from "./shell";

const WORKSPACE_ROOT = "/root/workspace";
const CMUX_RUNTIME_DIR = "/var/tmp/cmux-scripts";
const LOG_DIR = "/var/log/cmux";
const TMUX_SESSION_NAME = "cmux";

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
 * Create or reuse a tmux session and set up windows for maintenance and dev scripts.
 * This creates a persistent tmux session that can be attached to by the agent.
 */
export async function setupTmuxScripts({
  instance,
  maintenanceScript,
  devScript,
}: {
  instance: MorphInstance;
  maintenanceScript?: string | null;
  devScript?: string | null;
}): Promise<{ error: string | null }> {
  // If no scripts to run, nothing to do
  if (!maintenanceScript && !devScript) {
    return { error: null };
  }

  try {
    // First, ensure log directory exists
    const logDirCommand = `mkdir -p ${LOG_DIR}`;
    await instance.exec(`bash -c ${singleQuote(logDirCommand)}`);

    // Check if tmux session already exists
    const checkSessionCommand = `tmux has-session -t ${TMUX_SESSION_NAME} 2>/dev/null`;
    const sessionExists = await instance.exec(checkSessionCommand);

    // If session doesn't exist, create it with a default window
    if (sessionExists.exit_code !== 0) {
      const createSessionCommand = `tmux new-session -d -s ${TMUX_SESSION_NAME} -c ${WORKSPACE_ROOT}`;
      const createResult = await instance.exec(createSessionCommand);
      if (createResult.exit_code !== 0) {
        const stderrPreview = previewOutput(createResult.stderr, 500);
        return {
          error: `Failed to create tmux session: ${stderrPreview || "unknown error"}`,
        };
      }
    }

    // Run maintenance script if provided (in window 1)
    if (maintenanceScript) {
      const maintenanceRunId = randomUUID().replace(/-/g, "");
      const maintenanceScriptDir = `${CMUX_RUNTIME_DIR}/${maintenanceRunId}`;
      const maintenanceScriptPath = `${maintenanceScriptDir}/maintenance-script.sh`;
      const maintenanceLogFile = `${LOG_DIR}/maintenance-script.log`;

      const setupMaintenanceCommand = `
set -euo pipefail
mkdir -p ${maintenanceScriptDir}
${buildScriptFileCommand(maintenanceScriptPath, maintenanceScript)}

# Create a new window for maintenance script
tmux new-window -t ${TMUX_SESSION_NAME}:1 -n maintenance -c ${WORKSPACE_ROOT}

# Run the maintenance script in this window
tmux send-keys -t ${TMUX_SESSION_NAME}:1 "cd ${WORKSPACE_ROOT} && bash -eu -o pipefail ${maintenanceScriptPath} 2>&1 | tee ${maintenanceLogFile}; echo 'Maintenance script completed (exit code: '\$?')'; sleep 2" C-m
`;

      const maintenanceResult = await instance.exec(
        `bash -lc ${singleQuote(setupMaintenanceCommand)}`,
      );

      if (maintenanceResult.exit_code !== 0) {
        const stderrPreview = previewOutput(maintenanceResult.stderr, 2000);
        const stdoutPreview = previewOutput(maintenanceResult.stdout, 500);
        const messageParts = [
          `Failed to set up maintenance script window`,
          stderrPreview ? `stderr: ${stderrPreview}` : null,
          stdoutPreview ? `stdout: ${stdoutPreview}` : null,
        ].filter((part): part is string => part !== null);
        return { error: messageParts.join(" | ") };
      }
    }

    // Run dev script if provided (in window 2)
    if (devScript) {
      const devScriptRunId = randomUUID().replace(/-/g, "");
      const devScriptDir = `${CMUX_RUNTIME_DIR}/${devScriptRunId}`;
      const devScriptPath = `${devScriptDir}/dev-script.sh`;
      const devLogFile = `${LOG_DIR}/dev-script.log`;

      const setupDevCommand = `
set -euo pipefail
mkdir -p ${devScriptDir}
${buildScriptFileCommand(devScriptPath, devScript)}

# Create a new window for dev script
tmux new-window -t ${TMUX_SESSION_NAME}:2 -n dev -c ${WORKSPACE_ROOT}

# Run the dev script in this window (continuously running)
tmux send-keys -t ${TMUX_SESSION_NAME}:2 "cd ${WORKSPACE_ROOT} && bash -eu -o pipefail ${devScriptPath} 2>&1 | tee ${devLogFile}" C-m
`;

      const devResult = await instance.exec(
        `bash -lc ${singleQuote(setupDevCommand)}`,
      );

      if (devResult.exit_code !== 0) {
        const stderrPreview = previewOutput(devResult.stderr, 2000);
        const stdoutPreview = previewOutput(devResult.stdout, 500);
        const messageParts = [
          `Failed to set up dev script window`,
          stderrPreview ? `stderr: ${stderrPreview}` : null,
          stdoutPreview ? `stdout: ${stdoutPreview}` : null,
        ].filter((part): part is string => part !== null);
        return { error: messageParts.join(" | ") };
      }

      // Wait a moment for the dev script to start, then check if it's running
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check if the dev script window still has a running process
      const checkDevCommand = `tmux list-panes -t ${TMUX_SESSION_NAME}:2 -F '#{pane_pid}' 2>/dev/null`;
      const checkResult = await instance.exec(checkDevCommand);

      if (checkResult.exit_code !== 0 || !checkResult.stdout?.trim()) {
        // Dev script may have failed immediately; check logs
        const logCheckCommand = `tail -n 50 ${devLogFile} 2>/dev/null || echo "(no logs found)"`;
        const logResult = await instance.exec(logCheckCommand);
        const logPreview = previewOutput(logResult.stdout, 2000);
        return {
          error: `Dev script may have failed to start${logPreview ? ` | log: ${logPreview}` : ""}`,
        };
      }
    }

    return { error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      error: `Failed to set up tmux scripts: ${errorMessage}`,
    };
  }
}
