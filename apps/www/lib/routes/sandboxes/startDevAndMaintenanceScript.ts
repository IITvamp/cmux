import { randomUUID } from "node:crypto";

import type { MorphInstance } from "./git";
import { singleQuote } from "./shell";

const WORKSPACE_ROOT = "/root/workspace";
const CMUX_RUNTIME_DIR = "/var/tmp/cmux-scripts";
const LOG_DIR = "/var/log/cmux";

export type ScriptIdentifiers = {
  maintenanceId: string;
  maintenanceWindowName: string;
  maintenanceScriptPath: string;
  maintenanceLogFile: string;
  devId: string;
  devWindowName: string;
  devScriptPath: string;
  devLogFile: string;
};

export const allocateScriptIdentifiers = (): ScriptIdentifiers => {
  const maintenanceId = randomUUID().replace(/-/g, "").slice(0, 16);
  const devId = randomUUID().replace(/-/g, "").slice(0, 16);
  return {
    maintenanceId,
    maintenanceWindowName: `maintenance-${maintenanceId}`,
    maintenanceScriptPath: `${CMUX_RUNTIME_DIR}/maintenance-${maintenanceId}.sh`,
    maintenanceLogFile: `${LOG_DIR}/maintenance-${maintenanceId}.log`,
    devId,
    devWindowName: `dev-${devId}`,
    devScriptPath: `${CMUX_RUNTIME_DIR}/dev-${devId}.sh`,
    devLogFile: `${LOG_DIR}/dev-${devId}.log`,
  };
};

type ScriptResult = {
  maintenanceError: string | null;
  maintenanceWindowName: string | null;
  maintenanceLogFile: string | null;
  devError: string | null;
  devWindowName: string | null;
  devLogFile: string | null;
};

export async function runMaintenanceAndDevScripts({
  instance,
  maintenanceScript,
  devScript,
  identifiers,
}: {
  instance: MorphInstance;
  maintenanceScript?: string;
  devScript?: string;
  identifiers?: ScriptIdentifiers;
}): Promise<ScriptResult> {
  const ids = identifiers ?? allocateScriptIdentifiers();

  if (
    (!maintenanceScript || maintenanceScript.trim().length === 0) &&
    (!devScript || devScript.trim().length === 0)
  ) {
    return {
      maintenanceError: "Both maintenance and dev scripts are empty",
      maintenanceWindowName: null,
      maintenanceLogFile: null,
      devError: null,
      devWindowName: null,
      devLogFile: null,
    };
  }

  const waitForTmuxSession = `for i in {1..20}; do
  if tmux has-session -t cmux 2>/dev/null; then
    break
  fi
  sleep 0.5
done
if ! tmux has-session -t cmux 2>/dev/null; then
  echo "Error: cmux session does not exist" >&2
  exit 1
fi`;

  let maintenanceError: string | null = null;
  let devError: string | null = null;

  if (maintenanceScript && maintenanceScript.trim().length > 0) {
    const maintenanceScriptContent = `#!/bin/bash
set -eux
cd ${WORKSPACE_ROOT}

echo "=== Maintenance Script Started at \$(date) ==="
${maintenanceScript}
echo "=== Maintenance Script Completed at \$(date) ==="
`;

    const maintenanceCommand = `set -eu
mkdir -p ${LOG_DIR}
mkdir -p ${CMUX_RUNTIME_DIR}
cat > ${ids.maintenanceScriptPath} <<'SCRIPT_EOF'
${maintenanceScriptContent}
SCRIPT_EOF
chmod +x ${ids.maintenanceScriptPath}
${waitForTmuxSession}
tmux new-window -t cmux: -n ${ids.maintenanceWindowName} -d
tmux send-keys -t cmux:${ids.maintenanceWindowName} "bash ${ids.maintenanceScriptPath} 2>&1 | tee ${ids.maintenanceLogFile}" C-m
sleep 2
if tmux list-windows -t cmux | grep -q "${ids.maintenanceWindowName}"; then
  echo "[MAINTENANCE] Window is running"
  tail -20 ${ids.maintenanceLogFile} || echo "[MAINTENANCE] Log file not yet available"
else
  echo "[MAINTENANCE] Window may have exited (normal if script completed)"
  tail -20 ${ids.maintenanceLogFile} 2>/dev/null || echo "[MAINTENANCE] No logs available"
fi
`;

    try {
      const result = await instance.exec(
        `bash -lc ${singleQuote(maintenanceCommand)}`,
      );

      if (result.exit_code !== 0) {
        const stderr = result.stderr?.trim() || "";
        const stdout = result.stdout?.trim() || "";
        const messageParts = [
          `Failed to start maintenance script with exit code ${result.exit_code}`,
          stderr ? `stderr: ${stderr}` : null,
          stdout ? `stdout: ${stdout}` : null,
        ].filter((part): part is string => part !== null);
        maintenanceError = messageParts.join(" | ");
      } else {
        console.log(`[MAINTENANCE SCRIPT VERIFICATION]\n${result.stdout || ""}`);
      }
    } catch (error) {
      maintenanceError = `Maintenance script execution failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  if (devScript && devScript.trim().length > 0) {
    const devScriptContent = `#!/bin/bash
set -ux
cd ${WORKSPACE_ROOT}

echo "=== Dev Script Started at \$(date) ==="
${devScript}
`;

    const devCommand = `set -eu
mkdir -p ${LOG_DIR}
mkdir -p ${CMUX_RUNTIME_DIR}
cat > ${ids.devScriptPath} <<'SCRIPT_EOF'
${devScriptContent}
SCRIPT_EOF
chmod +x ${ids.devScriptPath}
${waitForTmuxSession}
tmux new-window -t cmux: -n ${ids.devWindowName} -d
tmux send-keys -t cmux:${ids.devWindowName} "bash ${ids.devScriptPath} 2>&1 | tee ${ids.devLogFile}" C-m
sleep 2
if tmux list-windows -t cmux | grep -q "${ids.devWindowName}"; then
  echo "[DEV] Window is running"
  tail -20 ${ids.devLogFile} || echo "[DEV] Log file not yet available"
else
  echo "[DEV] ERROR: Window not found" >&2
  exit 1
fi
`;

    try {
      const result = await instance.exec(`bash -lc ${singleQuote(devCommand)}`);

      if (result.exit_code !== 0) {
        const stderr = result.stderr?.trim() || "";
        const stdout = result.stdout?.trim() || "";
        const messageParts = [
          `Failed to start dev script with exit code ${result.exit_code}`,
          stderr ? `stderr: ${stderr}` : null,
          stdout ? `stdout: ${stdout}` : null,
        ].filter((part): part is string => part !== null);
        devError = messageParts.join(" | ");
      } else {
        console.log(`[DEV SCRIPT VERIFICATION]\n${result.stdout || ""}`);
      }
    } catch (error) {
      devError = `Dev script execution failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return {
    maintenanceError,
    maintenanceWindowName: maintenanceScript ? ids.maintenanceWindowName : null,
    maintenanceLogFile: maintenanceScript ? ids.maintenanceLogFile : null,
    devError,
    devWindowName: devScript ? ids.devWindowName : null,
    devLogFile: devScript ? ids.devLogFile : null,
  };
}
