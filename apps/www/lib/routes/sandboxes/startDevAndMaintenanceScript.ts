import { randomUUID } from "node:crypto";

import type { MorphInstance } from "./git";
import { maskSensitive, singleQuote } from "./shell";

const WORKSPACE_ROOT = "/root/workspace";
const CMUX_RUNTIME_DIR = "/var/tmp/cmux-scripts";
const LOG_DIR = "/var/log/cmux";
const TMUX_SESSION_NAME = "cmux";
const SHELL_WINDOW_NAME = "shell";
const DEV_WINDOW_NAME = "dev";
const MAINTENANCE_WINDOW_NAME = "maintenance";

const DEV_SCRIPT_PATH = `${CMUX_RUNTIME_DIR}/dev-script.sh`;
const DEV_RUNNER_PATH = `${CMUX_RUNTIME_DIR}/dev-runner.sh`;
const DEV_LOG_FILE = `${LOG_DIR}/dev-script.log`;

const MAINTENANCE_SCRIPT_PATH = `${CMUX_RUNTIME_DIR}/maintenance-script.sh`;
const MAINTENANCE_RUNNER_PATH = `${CMUX_RUNTIME_DIR}/maintenance-runner.sh`;
const MAINTENANCE_LOG_FILE = `${LOG_DIR}/maintenance-script.log`;
const MAINTENANCE_EXIT_CODE_PATH = `${CMUX_RUNTIME_DIR}/maintenance-exit-code`;

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

const ensureTmuxSessionCommand = `
if ! tmux has-session -t ${TMUX_SESSION_NAME} 2>/dev/null; then
  tmux new-session -d -s ${TMUX_SESSION_NAME} -c ${WORKSPACE_ROOT} -n ${SHELL_WINDOW_NAME}
else
  tmux rename-window -t ${TMUX_SESSION_NAME}:0 ${SHELL_WINDOW_NAME} 2>/dev/null || true
fi
tmux set-option -t ${TMUX_SESSION_NAME} remain-on-exit on
`;

const DEV_RUNNER_CONTENTS = `#!/usr/bin/env bash
set -euo pipefail

script_path="$1"
log_file="$2"
workspace_root="$3"

cd "$workspace_root"

: > "$log_file"

bash -eu -o pipefail "$script_path" |& tee "$log_file"
`;

const MAINTENANCE_RUNNER_CONTENTS = `#!/usr/bin/env bash
set -euo pipefail

signal="$1"
script_path="$2"
log_file="$3"
exit_code_file="$4"
workspace_root="$5"

cd "$workspace_root"

rm -f "$exit_code_file"
: > "$log_file"

exit_code=0
bash -eu -o pipefail "$script_path" |& tee "$log_file" || exit_code=$?
echo "$exit_code" > "$exit_code_file"
tmux wait-for -S "$signal"
exit "$exit_code"
`;

export async function runMaintenanceScript({
  instance,
  script,
}: {
  instance: MorphInstance;
  script: string;
}): Promise<{ error: string | null }> {
  const maintenanceSignal = `maintenance-${randomUUID().replace(/[^a-zA-Z0-9]/g, "")}`;
  const command = `
set -euo pipefail
mkdir -p ${CMUX_RUNTIME_DIR}
mkdir -p ${LOG_DIR}
${buildScriptFileCommand(MAINTENANCE_SCRIPT_PATH, script)}
${buildScriptFileCommand(
    MAINTENANCE_RUNNER_PATH,
    MAINTENANCE_RUNNER_CONTENTS,
  )}
${ensureTmuxSessionCommand}
tmux kill-window -t ${TMUX_SESSION_NAME}:${MAINTENANCE_WINDOW_NAME} 2>/dev/null || true
rm -f ${MAINTENANCE_EXIT_CODE_PATH}
tmux new-window -d -t ${TMUX_SESSION_NAME} -n ${MAINTENANCE_WINDOW_NAME} ${singleQuote(
    `exec ${MAINTENANCE_RUNNER_PATH} ${singleQuote(maintenanceSignal)} ${singleQuote(
      MAINTENANCE_SCRIPT_PATH,
    )} ${singleQuote(MAINTENANCE_LOG_FILE)} ${singleQuote(
      MAINTENANCE_EXIT_CODE_PATH,
    )} ${singleQuote(WORKSPACE_ROOT)}`,
  )}
tmux wait-for -L ${singleQuote(maintenanceSignal)}
exit_code=$(cat ${MAINTENANCE_EXIT_CODE_PATH} 2>/dev/null || echo 1)
if [ "$exit_code" != "0" ]; then
  echo "Maintenance script failed with exit code $exit_code" >&2
  if [ -f ${MAINTENANCE_LOG_FILE} ]; then
    tail -n 50 ${MAINTENANCE_LOG_FILE} >&2
  fi
  exit "$exit_code"
fi
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
  const command = `
set -euo pipefail
mkdir -p ${CMUX_RUNTIME_DIR}
mkdir -p ${LOG_DIR}
${buildScriptFileCommand(DEV_SCRIPT_PATH, script)}
${buildScriptFileCommand(DEV_RUNNER_PATH, DEV_RUNNER_CONTENTS)}
${ensureTmuxSessionCommand}
tmux kill-window -t ${TMUX_SESSION_NAME}:${DEV_WINDOW_NAME} 2>/dev/null || true
tmux new-window -d -t ${TMUX_SESSION_NAME} -n ${DEV_WINDOW_NAME} ${singleQuote(
    `exec ${DEV_RUNNER_PATH} ${singleQuote(DEV_SCRIPT_PATH)} ${singleQuote(
      DEV_LOG_FILE,
    )} ${singleQuote(WORKSPACE_ROOT)}`,
  )}
sleep 0.5
set +e
pane_output=$(tmux list-panes -t ${TMUX_SESSION_NAME}:${DEV_WINDOW_NAME} -F '#{pane_dead}' 2>/dev/null)
pane_rc=$?
set -e
if [ "$pane_rc" -ne 0 ]; then
  echo "Dev script pane inspection failed" >&2
  if [ -f ${DEV_LOG_FILE} ]; then
    tail -n 50 ${DEV_LOG_FILE} >&2
  fi
  exit 1
fi
pane_status=$(printf '%s' "$pane_output" | tr -d '\n')
if [ -n "\${pane_status//0/}" ]; then
  status=$(tmux display-message -p -t ${TMUX_SESSION_NAME}:${DEV_WINDOW_NAME} '#{pane_dead_status}' 2>/dev/null | tr -d '\n')
  if [ -z "$status" ]; then
    status="unknown"
  fi
  echo "Dev script exited immediately with status $status" >&2
  if [ -f ${DEV_LOG_FILE} ]; then
    tail -n 50 ${DEV_LOG_FILE} >&2
  fi
  exit 1
fi
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

    return { error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { error: `Dev script execution failed: ${errorMessage}` };
  }
}
