import type { MorphInstance } from "./git";
import { maskSensitive, singleQuote } from "./shell";
import {
  CMUX_RUNTIME_DIR,
  DEV_SCRIPT_PATH,
  MAINTENANCE_SCRIPT_PATH,
  TMUX_SETUP_SCRIPT_PATH,
  WORKSPACE_ROOT,
} from "@cmux/shared/sandboxPaths";

const buildScriptFileCommand = (path: string, contents: string): string => `
mkdir -p ${CMUX_RUNTIME_DIR}
cat <<'CMUX_SCRIPT_EOF' > ${path}
${contents}
CMUX_SCRIPT_EOF
chmod +x ${path}
`;

const generateTmuxSetupScript = (): string => `#!/usr/bin/env bash
set -euo pipefail

SESSION_NAME="\${1:-}"
if [ -z "$SESSION_NAME" ]; then
  # Nothing to do without a valid session target.
  exit 0
fi

if ! command -v tmux >/dev/null 2>&1; then
  exit 0
fi

if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  exit 0
fi

WORKSPACE_ROOT="${WORKSPACE_ROOT}"
MAINTENANCE_SCRIPT="${MAINTENANCE_SCRIPT_PATH}"
DEV_SCRIPT="${DEV_SCRIPT_PATH}"

window_exists() {
  local window_name="$1"
  tmux list-windows -t "$SESSION_NAME" -F '#{window_name}' 2>/dev/null | grep -Fx "$window_name" >/dev/null 2>&1
}

create_window() {
  local window_name="$1"
  shift
  local cmd=("$@")

  if window_exists "$window_name"; then
    return
  fi

  local escaped_command=""
  local part
  for part in "\${cmd[@]}"; do
    if [ -z "$escaped_command" ]; then
      escaped_command="$(printf "%q" "$part")"
    else
      escaped_command="\${escaped_command} $(printf "%q" "$part")"
    fi
  done

  tmux new-window \
    -d \
    -t "$SESSION_NAME" \
    -n "$window_name" \
    "bash -lc 'cd ${WORKSPACE_ROOT} || exit 1; set -euo pipefail; exec \${escaped_command}'"
}

if [ -x "$MAINTENANCE_SCRIPT" ]; then
  create_window "maintenance" "$MAINTENANCE_SCRIPT"
fi

if [ -x "$DEV_SCRIPT" ]; then
  create_window "dev" "$DEV_SCRIPT"
fi
`;

const preview = (value: string | undefined | null, maxLength = 2000): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = maskSensitive(value).trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength)}…`;
};

export async function configureDevAndMaintenanceScripts({
  instance,
  maintenanceScript,
  devScript,
}: {
  instance: MorphInstance;
  maintenanceScript?: string | null;
  devScript?: string | null;
}): Promise<void> {
  const trimmedMaintenance = maintenanceScript?.trim();
  const trimmedDev = devScript?.trim();

  const shouldWriteMaintenance = Boolean(trimmedMaintenance && trimmedMaintenance.length > 0);
  const shouldWriteDev = Boolean(trimmedDev && trimmedDev.length > 0);
  const shouldWriteSetup = shouldWriteMaintenance || shouldWriteDev;

  const scriptPieces: string[] = ["set -euo pipefail"];

  if (shouldWriteMaintenance && trimmedMaintenance) {
    scriptPieces.push(buildScriptFileCommand(MAINTENANCE_SCRIPT_PATH, trimmedMaintenance).trim());
  } else {
    scriptPieces.push(`rm -f ${MAINTENANCE_SCRIPT_PATH}`);
  }

  if (shouldWriteDev && trimmedDev) {
    scriptPieces.push(buildScriptFileCommand(DEV_SCRIPT_PATH, trimmedDev).trim());
  } else {
    scriptPieces.push(`rm -f ${DEV_SCRIPT_PATH}`);
  }

  if (shouldWriteSetup) {
    scriptPieces.push(buildScriptFileCommand(TMUX_SETUP_SCRIPT_PATH, generateTmuxSetupScript()).trim());
  } else {
    scriptPieces.push(`rm -f ${TMUX_SETUP_SCRIPT_PATH}`);
  }

  const command = scriptPieces.join("\n");

  const result = await instance.exec(`bash -lc ${singleQuote(command)}`);

  if (result.exit_code !== 0) {
    const stderrPreview = preview(result.stderr);
    const stdoutPreview = preview(result.stdout, 400);
    const messageParts = [
      `Failed to configure environment scripts (exit ${result.exit_code})`,
      stderrPreview ? `stderr: ${stderrPreview}` : null,
      stdoutPreview ? `stdout: ${stdoutPreview}` : null,
    ].filter((part): part is string => part !== null);
    throw new Error(messageParts.join(" | "));
  }
}
