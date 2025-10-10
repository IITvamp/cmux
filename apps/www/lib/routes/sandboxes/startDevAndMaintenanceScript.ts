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
  console.log("[cmux] runMaintenanceScript", {
    session: ids.sessionName,
    runnerPath: ids.runnerPath,
    hasIdentifiers: Boolean(identifiers),
    scriptLength: script.length,
    scriptSample: script.slice(0, 80),
  });

  if (!script || script.trim().length === 0) {
    return {
      error: "Maintenance script is empty",
      sessionName: ids.sessionName,
      logFile: ids.logFile,
    };
  }
  const command = `set -eux
mkdir -p ${LOG_DIR}
mkdir -p ${CMUX_RUNTIME_DIR}
cat > ${ids.scriptPath} <<'SCRIPT_EOF'
${script}
SCRIPT_EOF
chmod +x ${ids.scriptPath}
echo "[DEBUG] Starting tmux server if needed..."
tmux start-server 2>&1 || echo "Server already running"
echo "[DEBUG] Killing existing session if any..."
set +e
tmux kill-session -t ${ids.sessionName} 2>&1
set -e
echo "[DEBUG] Creating new tmux session: ${ids.sessionName}"
tmux new-session -d -s ${ids.sessionName} bash
echo "[DEBUG] Sending command to tmux session"
tmux send-keys -t ${ids.sessionName} "cd ${WORKSPACE_ROOT} && bash ${ids.scriptPath} 2>&1 | tee ${ids.logFile}; echo \$? > ${ids.exitFile}; tmux wait-for -S ${ids.waitName}" C-m
echo "[DEBUG] Waiting for completion signal: ${ids.waitName}"
tmux wait-for ${ids.waitName}
echo "[DEBUG] Wait completed, reading exit code"
exit_code=$(cat ${ids.exitFile} 2>&1 || echo 1)
echo "[DEBUG] Exit code: \$exit_code"
tmux kill-session -t ${ids.sessionName} 2>&1 || echo "Session already gone"
exit \$exit_code
`;

  try {
    console.log("[cmux] Executing maintenance command", {
      commandLength: command.length,
      commandSample: command.slice(0, 200),
    });
    const result = await instance.exec(`bash -lc ${singleQuote(command)}`);

    console.log("[cmux] Maintenance command completed", {
      exitCode: result.exit_code,
      stdoutLength: result.stdout?.length ?? 0,
      stderrLength: result.stderr?.length ?? 0,
      stdoutPreview: result.stdout?.slice(0, 500),
      stderrPreview: result.stderr?.slice(0, 500),
    });

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
  console.log("[cmux] startDevScript", {
    session: ids.sessionName,
    runnerPath: ids.runnerPath,
    hasIdentifiers: Boolean(identifiers),
    scriptLength: script.length,
    scriptSample: script.slice(0, 80),
  });

  if (!script || script.trim().length === 0) {
    return {
      error: "Dev script is empty",
      sessionName: ids.sessionName,
      logFile: ids.logFile,
    };
  }
  const devScriptDir = `${CMUX_RUNTIME_DIR}/${ids.id}`;
  const devScriptPath = `${devScriptDir}/dev-script.sh`;
  const command = `set -eux
mkdir -p ${LOG_DIR}
mkdir -p ${devScriptDir}
cat > ${devScriptPath} <<'SCRIPT_EOF'
${script}
SCRIPT_EOF
chmod +x ${devScriptPath}
echo "[DEBUG] Starting tmux server if needed..."
tmux start-server 2>&1 || echo "Server already running"
echo "[DEBUG] Killing existing dev session if any..."
set +e
tmux kill-session -t ${ids.sessionName} 2>&1
set -e
echo "[DEBUG] Creating new dev tmux session: ${ids.sessionName}"
tmux new-session -d -s ${ids.sessionName} bash
echo "[DEBUG] Setting up pipe-pane for logging"
tmux pipe-pane -t ${ids.sessionName} -o "cat >> ${ids.logFile}"
echo "[DEBUG] Sending cd command"
tmux send-keys -t ${ids.sessionName} "cd ${WORKSPACE_ROOT}" C-m
echo "[DEBUG] Sending dev script command"
tmux send-keys -t ${ids.sessionName} "bash ${devScriptPath}" C-m
sleep 0.5
echo "[DEBUG] Checking if session is still alive"
if ! tmux has-session -t ${ids.sessionName} 2>&1; then
  echo "[ERROR] Dev script session died immediately" >&2
  cat ${ids.logFile} 2>&1 || echo "No log file"
  exit 1
fi
echo "[SUCCESS] Dev script started in tmux session ${ids.sessionName}"
exit 0
`;

  try {
    console.log("[cmux] Executing dev command", {
      commandLength: command.length,
      commandSample: command.slice(0, 200),
    });
    const result = await instance.exec(`bash -lc ${singleQuote(command)}`);

    console.log("[cmux] Dev command completed", {
      exitCode: result.exit_code,
      stdoutLength: result.stdout?.length ?? 0,
      stderrLength: result.stderr?.length ?? 0,
      stdoutPreview: result.stdout?.slice(0, 500),
      stderrPreview: result.stderr?.slice(0, 500),
    });

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
