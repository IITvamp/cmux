import { randomUUID } from "node:crypto";

import type { MorphInstance } from "./git";
import { singleQuote } from "./shell";

const WORKSPACE_ROOT = "/root/workspace";
const CMUX_RUNTIME_DIR = "/var/tmp/cmux-scripts";

export type ScriptIdentifiers = {
  maintenanceId: string;
  maintenanceWindowName: string;
  maintenanceScriptPath: string;
  devId: string;
  devWindowName: string;
  devScriptPath: string;
};

export const allocateScriptIdentifiers = (): ScriptIdentifiers => {
  const maintenanceId = randomUUID().replace(/-/g, "").slice(0, 16);
  const devId = randomUUID().replace(/-/g, "").slice(0, 16);
  return {
    maintenanceId,
    maintenanceWindowName: `maintenance-${maintenanceId}`,
    maintenanceScriptPath: `${CMUX_RUNTIME_DIR}/maintenance-${maintenanceId}.sh`,
    devId,
    devWindowName: `dev-${devId}`,
    devScriptPath: `${CMUX_RUNTIME_DIR}/dev-${devId}.sh`,
  };
};

type ScriptResult = {
  maintenanceError: string | null;
  devError: string | null;
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
      devError: null,
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
mkdir -p ${CMUX_RUNTIME_DIR}
cat > ${ids.maintenanceScriptPath} <<'SCRIPT_EOF'
${maintenanceScriptContent}
SCRIPT_EOF
chmod +x ${ids.maintenanceScriptPath}
${waitForTmuxSession}
tmux new-window -t cmux: -n ${ids.maintenanceWindowName} -d
tmux send-keys -t cmux:${ids.maintenanceWindowName} "bash ${ids.maintenanceScriptPath}" C-m
sleep 2
if tmux list-windows -t cmux | grep -q "${ids.maintenanceWindowName}"; then
  echo "[MAINTENANCE] Window is running"
else
  echo "[MAINTENANCE] Window may have exited (normal if script completed)"
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
mkdir -p ${CMUX_RUNTIME_DIR}
cat > ${ids.devScriptPath} <<'SCRIPT_EOF'
${devScriptContent}
SCRIPT_EOF
chmod +x ${ids.devScriptPath}
${waitForTmuxSession}
tmux new-window -t cmux: -n ${ids.devWindowName} -d
tmux send-keys -t cmux:${ids.devWindowName} "bash ${ids.devScriptPath}" C-m
sleep 2
if tmux list-windows -t cmux | grep -q "${ids.devWindowName}"; then
  echo "[DEV] Window is running"
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
    devError,
  };
}
