import { randomUUID } from "node:crypto";

import type { MorphInstance } from "./git";
import { maskSensitive, singleQuote } from "./shell";

const WORKSPACE_ROOT = "/root/workspace";
const CMUX_RUNTIME_DIR = "/var/tmp/cmux-scripts";
const LOG_DIR = "/var/log/cmux";
const DEV_TMUX_SESSION = "cmux-dev";
const MAINTENANCE_TMUX_SESSION = "cmux-maintenance";
const MAINTENANCE_LOG_FILE = `${LOG_DIR}/maintenance-script.log`;

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

const prependWorkspaceCdToDevScript = (script: string): string => {
  if (script.startsWith("#!")) {
    const newlineIndex = script.indexOf("\n");
    if (newlineIndex === -1) {
      return `${script}\ncd ${WORKSPACE_ROOT}\n`;
    }
    const shebang = script.slice(0, newlineIndex);
    const rest = script.slice(newlineIndex + 1);
    return `${shebang}\ncd ${WORKSPACE_ROOT}\n${rest}`;
  }
  return `cd ${WORKSPACE_ROOT}\n${script}`;
};

const ensureSessionStoppedCommand = (
  pidFile: string,
  sessionName: string,
): string => `
if [ -f ${pidFile} ]; then
  (
    set -euo pipefail
    trap 'status=$?; echo "Failed to stop process recorded in ${pidFile} (pid \${EXISTING_PID:-unknown}) (exit $status)" >&2' ERR
    EXISTING_PID=$(cat ${pidFile} 2>/dev/null || true)
    if [ -n "\${EXISTING_PID}" ] && kill -0 \${EXISTING_PID} 2>/dev/null; then
      if kill \${EXISTING_PID} 2>/dev/null; then
        sleep 0.2
      elif kill -0 \${EXISTING_PID} 2>/dev/null; then
        echo "Unable to terminate process \${EXISTING_PID}" >&2
        exit 1
      fi

      if kill -0 \${EXISTING_PID} 2>/dev/null; then
        echo "Process \${EXISTING_PID} still running after SIGTERM" >&2
        exit 1
      fi
    fi
  )
fi
if tmux has-session -t ${sessionName} 2>/dev/null; then
  tmux kill-session -t ${sessionName} 2>/dev/null || true
fi
rm -f ${pidFile}
`;

export async function runMaintenanceScript({
  instance,
  script,
}: {
  instance: MorphInstance;
  script: string;
}): Promise<{ error: string | null }> {
  const maintenanceScriptPath = `${CMUX_RUNTIME_DIR}/maintenance-script.sh`;
  const maintenanceScriptContent = [
    "#!/bin/bash",
    "set -euo pipefail",
    `cd ${WORKSPACE_ROOT}`,
    script,
    "",
  ].join("\n");
  const maintenanceExecutorPath = `${CMUX_RUNTIME_DIR}/maintenance-executor.sh`;
  const maintenanceExitCodePath = `${CMUX_RUNTIME_DIR}/maintenance-exit-code`;
  const maintenanceExecutorContent = [
    "#!/bin/bash",
    "set -euo pipefail",
    `cd ${WORKSPACE_ROOT}`,
    `log_file=\"${MAINTENANCE_LOG_FILE}\"`,
    `script_path=\"${maintenanceScriptPath}\"`,
    `exit_file=\"${maintenanceExitCodePath}\"`,
    "rm -f \"${exit_file}\"",
    "echo \"[CMUX_MAINT_SCRIPT] starting\" | tee -a \"${log_file}\"",
    "{",
    "  bash -eu -o pipefail \"${script_path}\"",
    "} 2>&1 | tee -a \"${log_file}\"",
    "status=${PIPESTATUS[0]}",
    "printf \"%s\" \"${status}\" > \"${exit_file}\"",
    "if [ \"${status}\" -ne 0 ]; then",
    "  echo \"[CMUX_MAINT_SCRIPT] failed with exit code ${status}\" | tee -a \"${log_file}\"",
    "  exec bash",
    "fi",
    "echo \"[CMUX_MAINT_SCRIPT] completed successfully\" | tee -a \"${log_file}\"",
  ].join("\n");
  const maintenanceBootstrapScript = [
    "import { $ } from \"bun\";",
    "import { mkdir, writeFile, readFile, rm } from \"node:fs/promises\";",
    "import { dirname } from \"node:path\";",
    "",
    `const runtimeDir = "${CMUX_RUNTIME_DIR}";`,
    `const logFile = "${MAINTENANCE_LOG_FILE}";`,
    `const maintenanceSession = "${MAINTENANCE_TMUX_SESSION}";`,
    `const maintenanceScriptPath = "${maintenanceScriptPath}";`,
    `const maintenanceExecutorPath = "${maintenanceExecutorPath}";`,
    `const maintenanceExitCodePath = "${maintenanceExitCodePath}";`,
    "",
    `const maintenanceScript = ${JSON.stringify(maintenanceScriptContent)};`,
    `const maintenanceExecutor = ${JSON.stringify(maintenanceExecutorContent)};`,
    "",
    "const logDir = dirname(logFile);",
    "",
    "await mkdir(runtimeDir, { recursive: true });",
    "await mkdir(logDir, { recursive: true });",
    "await writeFile(logFile, \"\", { flag: \"w\" });",
    "await writeFile(maintenanceScriptPath, maintenanceScript, { mode: 0o755 });",
    "await writeFile(maintenanceExecutorPath, maintenanceExecutor, { mode: 0o755 });",
    "await rm(maintenanceExitCodePath, { force: true });",
    "",
    "await $`tmux kill-session -t ${maintenanceSession}`.nothrow();",
    "await $`tmux new-session -d -s ${maintenanceSession} ${maintenanceExecutorPath}`;",
    "",
    "let exitCode: number | null = null;",
    "for (let attempt = 0; attempt < 600; attempt++) {",
    "  try {",
    "    const raw = await readFile(maintenanceExitCodePath, \"utf8\");",
    "    const parsed = Number.parseInt(raw.trim(), 10);",
    "    exitCode = Number.isNaN(parsed) ? 1 : parsed;",
    "    break;",
    "  } catch (error) {",
    "    const hasSession = await $`tmux has-session -t ${maintenanceSession}`.nothrow();",
    "    if (hasSession.exitCode !== 0) {",
    "      exitCode = 0;",
    "      break;",
    "    }",
    "  }",
    "  await Bun.sleep(500);",
    "}",
    "",
    "if (exitCode === null) {",
    "  exitCode = 1;",
    "}",
    "",
    "if (exitCode === 0) {",
    "  const hasSession = await $`tmux has-session -t ${maintenanceSession}`.nothrow();",
    "  if (hasSession.exitCode === 0) {",
    "    await $`tmux kill-session -t ${maintenanceSession}`.nothrow();",
    "  }",
    "  await rm(maintenanceExitCodePath, { force: true });",
    "  console.log('[CMUX_MAINT_SCRIPT] completed successfully');",
    "  process.exit(0);",
    "}",
    "",
    "console.error(`[CMUX_MAINT_SCRIPT] failed with exit code ${exitCode}`);",
    "process.exit(exitCode ?? 1);",
  ].join("\n");
  const command = `
set -euo pipefail
mkdir -p ${CMUX_RUNTIME_DIR}
cat <<'CMUX_BUN_BOOTSTRAP' > ${CMUX_RUNTIME_DIR}/maintenance-bootstrap.ts
${maintenanceBootstrapScript}
CMUX_BUN_BOOTSTRAP
bun run ${CMUX_RUNTIME_DIR}/maintenance-bootstrap.ts
`;

  try {
    console.log("[CMUX_MAINT_TMUX_DEBUG] Launching maintenance tmux session", {
      instanceId: instance.id,
      commandPreview: previewOutput(command, 500),
    });
    const result = await instance.exec(`bash -lc ${singleQuote(command)}`);

    console.log("[CMUX_MAINT_TMUX_DEBUG] Maintenance tmux session finished", {
      instanceId: instance.id,
      exitCode: result.exit_code,
      stdout: previewOutput(result.stdout, 500),
      stderr: previewOutput(result.stderr, 500),
    });

    if (result.exit_code !== 0) {
      const stderrPreview = previewOutput(result.stderr, 2000);
      const stdoutPreview = previewOutput(result.stdout, 500);
      const messageParts = [
        `Maintenance tmux bootstrap failed with exit code ${result.exit_code}`,
        stderrPreview ? `stderr: ${stderrPreview}` : null,
        stdoutPreview ? `stdout: ${stdoutPreview}` : null,
      ].filter((part): part is string => part !== null);
      return { error: messageParts.join(" | ") };
    }

    return { error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { error: `Maintenance tmux bootstrap failed: ${errorMessage}` };
  }
}

export async function startDevScript({
  instance,
  script,
}: {
  instance: MorphInstance;
  script: string;
}): Promise<{ error: string | null }> {
  const devScriptRunId = randomUUID().replace(/-/g, "");
  const devScriptDir = `${CMUX_RUNTIME_DIR}/${devScriptRunId}`;
  const devScriptPath = `${devScriptDir}/dev-script.sh`;
  const devWrapperPath = `${devScriptDir}/dev-wrapper.sh`;
  const pidFile = `${LOG_DIR}/dev-script.pid`;
  const logFile = `${LOG_DIR}/dev-script.log`;
  const scriptWithWorkspace = prependWorkspaceCdToDevScript(script);
  const devWrapperContents = [
    "#!/bin/bash",
    "set -euo pipefail",
    `trap 'rm -f ${devWrapperPath} ${devScriptPath}; rm -rf ${devScriptDir}' EXIT`,
    `cd ${WORKSPACE_ROOT}`,
    `exec > >(tee -a ${logFile}) 2>&1`,
    "status=0",
    `bash -eu -o pipefail ${devScriptPath} || status=$?`,
    `exit "$status"`,
  ].join("\n");

  const command = `
set -euo pipefail
mkdir -p ${LOG_DIR}
${ensureSessionStoppedCommand(pidFile, DEV_TMUX_SESSION)}
rm -rf ${devScriptDir}
mkdir -p ${devScriptDir}
${buildScriptFileCommand(devScriptPath, scriptWithWorkspace)}
: > ${logFile}
${buildScriptFileCommand(devWrapperPath, devWrapperContents)}
tmux new-session -d -s ${DEV_TMUX_SESSION} "bash -eu -o pipefail ${devWrapperPath}"
sleep 0.5
if tmux has-session -t ${DEV_TMUX_SESSION} 2>/dev/null; then
  tmux display-message -p -t ${DEV_TMUX_SESSION}:0 "#{pane_pid}" | tr -d '[:space:]' > ${pidFile}
  if [ ! -s ${pidFile} ]; then
    rm -f ${pidFile}
  fi
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

    // Check if the process started successfully and is still running
    const checkCommand = `
sleep 0.5
if [ -f ${pidFile} ]; then
  PID=$(cat ${pidFile} 2>/dev/null || echo "")
  if [ -n "\$PID" ]; then
    if ! kill -0 \$PID 2>/dev/null; then
      if [ -f ${logFile} ]; then
        tail -n 50 ${logFile}
      fi
      exit 1
    fi
    exit 0
  fi
fi
if ! tmux has-session -t ${DEV_TMUX_SESSION} 2>/dev/null; then
  if [ -f ${logFile} ]; then
    tail -n 50 ${logFile}
  fi
  exit 1
fi
`;

    const checkResult = await instance.exec(
      `bash -c ${singleQuote(checkCommand)}`,
    );

    if (checkResult.exit_code !== 0) {
      const logPreview = previewOutput(checkResult.stdout, 2000);
      return {
        error: `Dev script failed immediately after start${logPreview ? ` | log: ${logPreview}` : ""}`,
      };
    }

    return { error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { error: `Dev script execution failed: ${errorMessage}` };
  }
}
