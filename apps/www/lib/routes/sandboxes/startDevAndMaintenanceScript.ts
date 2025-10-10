import { randomUUID } from "node:crypto";

import type { MorphInstance } from "./git";
import { maskSensitive, singleQuote } from "./shell";

const WORKSPACE_ROOT = "/root/workspace";
const CMUX_RUNTIME_DIR = "/var/tmp/cmux-scripts";
const LOG_DIR = "/var/log/cmux";

const sanitizeTmuxSessionName = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_-]/g, "_");

type ScriptPrefix = "maintenance" | "dev";

export type ScriptIdentifiers = {
  id: string;
  sessionName: string;
  scriptPath: string;
  runnerPath: string;
  logFile: string;
  exitFile: string;
  waitName: string;
};

const buildScriptId = (prefix: ScriptPrefix): ScriptIdentifiers => {
  const id = randomUUID().replace(/-/g, "").slice(0, 16);
  const base = `cmux-${prefix}-${id}`;
  const sessionName = sanitizeTmuxSessionName(base);
  return {
    id,
    sessionName,
    scriptPath: `${CMUX_RUNTIME_DIR}/${prefix}-script-${id}.sh`,
    runnerPath: `${CMUX_RUNTIME_DIR}/${prefix}-runner-${id}.sh`,
    logFile: `${LOG_DIR}/${prefix}-script-${id}.log`,
    exitFile: `${LOG_DIR}/${prefix}-script-${id}.exit`,
    waitName: sanitizeTmuxSessionName(`${base}-done`),
  };
};

export const allocateScriptIdentifiers = (prefix: ScriptPrefix): ScriptIdentifiers =>
  buildScriptId(prefix);

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

type ScriptResult = {
  error: string | null;
  sessionName: string;
  logFile: string;
};

export async function runMaintenanceScript({
  instance,
  script,
  identifiers,
}: {
  instance: MorphInstance;
  script: string;
  identifiers?: ScriptIdentifiers;
}): Promise<ScriptResult> {
  const ids = identifiers ?? buildScriptId("maintenance");
  const command = `
set -euo pipefail
mkdir -p ${LOG_DIR}
${buildScriptFileCommand(ids.scriptPath, script)}
cat <<'CMUX_MAINT_RUNNER_EOF' > ${ids.runnerPath}
#!/usr/bin/env bash
set -euo pipefail
cleanup() {
  status=$?
  printf '%s' "\${status}" > ${ids.exitFile}
  tmux wait-for -S ${ids.waitName}
  exit "\${status}"
}
trap cleanup EXIT
cd ${WORKSPACE_ROOT}
bash -eu -o pipefail ${ids.scriptPath}
CMUX_MAINT_RUNNER_EOF
chmod +x ${ids.runnerPath}
tmux kill-session -t ${ids.sessionName} 2>/dev/null || true
rm -f ${ids.exitFile}
: > ${ids.logFile}
tmux new-session -d -s ${ids.sessionName} "bash --login"
tmux pipe-pane -t ${ids.sessionName}:0 -o 'cat >> ${ids.logFile}'
sleep 0.25
tmux send-keys -t ${ids.sessionName}:0 "${ids.runnerPath}" C-m
tmux wait-for -L ${ids.waitName}
status=$(cat ${ids.exitFile} 2>/dev/null || echo '1')
rm -f ${ids.exitFile}
if [ "${status}" = "0" ]; then
  tmux send-keys -t ${ids.sessionName}:0 "printf \"\\n[cmux] Maintenance script completed successfully. Closing session.\\n\"" C-m
  sleep 0.2
  tmux kill-session -t ${ids.sessionName} 2>/dev/null || true
  rm -f ${ids.runnerPath} ${ids.scriptPath}
else
  tmux send-keys -t ${ids.sessionName}:0 "printf \"\\n[cmux] Maintenance script failed with exit code \$status. Session left open for inspection.\\n\"" C-m
fi
if [ ! -f ${ids.logFile} ]; then
  touch ${ids.logFile}
fi
exit "${status}"
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
      return {
        error: messageParts.join(" | "),
        sessionName: ids.sessionName,
        logFile: ids.logFile,
      };
    }

    return {
      error: null,
      sessionName: ids.sessionName,
      logFile: ids.logFile,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      error: `Maintenance script execution failed: ${errorMessage}`,
      sessionName: ids.sessionName,
      logFile: ids.logFile,
    };
  }
}

export async function startDevScript({
  instance,
  script,
  identifiers,
}: {
  instance: MorphInstance;
  script: string;
  identifiers?: ScriptIdentifiers;
}): Promise<ScriptResult> {
  const ids = identifiers ?? buildScriptId("dev");
  const devScriptDir = `${CMUX_RUNTIME_DIR}/${ids.id}`;
  const devScriptPath = `${devScriptDir}/dev-script.sh`;
  const command = `
set -euo pipefail
mkdir -p ${LOG_DIR}
mkdir -p ${devScriptDir}
${buildScriptFileCommand(devScriptPath, script)}
cat <<'CMUX_DEV_RUNNER_EOF' > ${ids.runnerPath}
#!/usr/bin/env bash
set -euo pipefail
cleanup() {
  status=$?
  printf '%s' "\\${status}" > ${ids.exitFile}
  exit "\\${status}"
}
trap cleanup EXIT
cd ${WORKSPACE_ROOT}
bash -eu -o pipefail ${devScriptPath}
CMUX_DEV_RUNNER_EOF
chmod +x ${ids.runnerPath}
tmux kill-session -t ${ids.sessionName} 2>/dev/null || true
rm -f ${ids.exitFile}
: > ${ids.logFile}
tmux new-session -d -s ${ids.sessionName} "bash --login"
tmux pipe-pane -t ${ids.sessionName}:0 -o 'cat >> ${ids.logFile}'
sleep 0.25
tmux send-keys -t ${ids.sessionName}:0 "${ids.runnerPath}" C-m
sleep 1
if [ -f ${ids.exitFile} ]; then
  status=$(cat ${ids.exitFile} 2>/dev/null || echo '1')
  if [ "${status}" = "0" ]; then
    tmux send-keys -t ${ids.sessionName}:0 "printf \"\\n[cmux] Dev script exited immediately with status 0. Session left open for debugging.\\n\"" C-m
    exit 1
  fi
  tmux send-keys -t ${ids.sessionName}:0 "printf \"\\n[cmux] Dev script exited with status \$status. Session left open for debugging.\\n\"" C-m
  exit "${status}"
fi
if [ ! -f ${ids.logFile} ]; then
  touch ${ids.logFile}
fi
exit 0
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
      return {
        error: messageParts.join(" | "),
        sessionName: ids.sessionName,
        logFile: ids.logFile,
      };
    }

    return {
      error: null,
      sessionName: ids.sessionName,
      logFile: ids.logFile,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      error: `Dev script execution failed: ${errorMessage}`,
      sessionName: ids.sessionName,
      logFile: ids.logFile,
    };
  }
}
