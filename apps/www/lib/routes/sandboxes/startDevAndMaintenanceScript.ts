import { randomUUID } from "node:crypto";

import type { EnvironmentScriptEntry, EnvironmentScriptManifest } from "@cmux/shared/tmux-scripts";
import {
  CMUX_LOG_DIR,
  CMUX_WORKSPACE_ROOT,
  TMUX_RUNTIME_DIR,
  manifestPathForNamespace,
  sanitizeScriptNamespace,
  scriptDirectoryForNamespace,
} from "@cmux/shared/tmux-scripts";

import type { MorphInstance } from "./git";
import { singleQuote } from "./shell";

const WORKSPACE_ROOT = CMUX_WORKSPACE_ROOT;

const buildScriptFileCommand = (path: string, contents: string): string => `
cat <<'CMUX_SCRIPT_EOF' > ${path}
${contents}
CMUX_SCRIPT_EOF
chmod +x ${path}
`;

const writeFileCommand = (path: string, contents: string): string => `
cat <<'CMUX_FILE_EOF' > ${path}
${contents}
CMUX_FILE_EOF
`;

interface QueuedScriptConfig {
  namespace: string;
  id: string;
  name: string;
  script: string;
  mode: EnvironmentScriptEntry["mode"];
  logFile: string;
  statusFile?: string;
}

const buildQueuedScript = (config: QueuedScriptConfig): {
  command: string;
  entry: EnvironmentScriptEntry;
} => {
  const { namespace, id, name, script, mode, logFile, statusFile } = config;
  const scriptDir = scriptDirectoryForNamespace(namespace);
  const scriptPath = `${scriptDir}/${id}-script.sh`;

  const trimmedScript = script.trimEnd();
  const headerLines = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    `LOG_FILE=${logFile}`,
    statusFile ? `STATUS_FILE=${statusFile}` : undefined,
    'mkdir -p "$(dirname "$LOG_FILE")"',
    'touch "$LOG_FILE"',
    statusFile ? 'rm -f "$STATUS_FILE"' : undefined,
    'exec > >(tee -a "$LOG_FILE")',
    'exec 2>&1',
    statusFile ? 'trap \'status=$?; echo $status > "$STATUS_FILE"\' EXIT' : undefined,
    `cd ${WORKSPACE_ROOT}`,
    "",
  ].filter((line): line is string => Boolean(line));

  const scriptContent = `${headerLines.join("\n")}${trimmedScript}\n`;

  const commands = [
    buildScriptFileCommand(scriptPath, scriptContent),
    statusFile ? `rm -f ${statusFile}` : undefined,
  ].filter((cmd): cmd is string => Boolean(cmd));

  const entry: EnvironmentScriptEntry = {
    id,
    name,
    mode,
    scriptPath,
    workingDirectory: WORKSPACE_ROOT,
    logPath: logFile,
    ...(statusFile ? { statusFile } : {}),
  };

  return { command: commands.join("\n"), entry };
};

interface PrepareScriptsForTmuxParams {
  instance: MorphInstance;
  maintenanceScript?: string | null;
  devScript?: string | null;
  taskRunId?: string | null;
}

export async function prepareScriptsForTmux({
  instance,
  maintenanceScript,
  devScript,
  taskRunId,
}: PrepareScriptsForTmuxParams): Promise<void> {
  if (!maintenanceScript && !devScript) {
    return;
  }

  if (!taskRunId) {
    console.warn(
      "[prepareScriptsForTmux] Missing taskRunId; skipping tmux script preparation",
    );
    return;
  }

  const namespace = sanitizeScriptNamespace(taskRunId);
  const scriptDir = scriptDirectoryForNamespace(namespace);
  const manifestPath = manifestPathForNamespace(namespace);
  const tempNamespace = sanitizeScriptNamespace(
    `${taskRunId}-${randomUUID().slice(0, 8)}`,
  );
  const tempScriptDir = scriptDirectoryForNamespace(tempNamespace);
  const tempManifestPath = manifestPathForNamespace(tempNamespace);

  const setupCommands: string[] = [
    "set -euo pipefail",
    `mkdir -p ${TMUX_RUNTIME_DIR}`,
    `rm -rf ${tempScriptDir}`,
    `mkdir -p ${tempScriptDir}`,
    `mkdir -p ${CMUX_LOG_DIR}`,
  ];

  const entries: EnvironmentScriptEntry[] = [];

  if (maintenanceScript) {
    const maintenanceConfig = buildQueuedScript({
      namespace: tempNamespace,
      id: "maintenance",
      name: "maintenance",
      script: maintenanceScript,
      mode: "oneshot",
      logFile: `${CMUX_LOG_DIR}/maintenance-script.log`,
      statusFile: `${CMUX_LOG_DIR}/maintenance-script.status`,
    });
    setupCommands.push(maintenanceConfig.command);
    entries.push(maintenanceConfig.entry);
  }

  if (devScript) {
    const devConfig = buildQueuedScript({
      namespace: tempNamespace,
      id: "dev",
      name: "dev",
      script: devScript,
      mode: "continuous",
      logFile: `${CMUX_LOG_DIR}/dev-script.log`,
      statusFile: `${CMUX_LOG_DIR}/dev-script.status`,
    });
    setupCommands.push(devConfig.command);
    entries.push(devConfig.entry);
  }

  if (entries.length === 0) {
    return;
  }

  const manifest: EnvironmentScriptManifest = {
    version: 1,
    namespace: tempNamespace,
    scripts: entries,
  };

  setupCommands.push(writeFileCommand(tempManifestPath, JSON.stringify(manifest)));
  setupCommands.push(`rm -rf ${scriptDir}`);
  setupCommands.push(`mv ${tempScriptDir} ${scriptDir}`);
  setupCommands.push(`ln -sf ${manifestPath} ${TMUX_RUNTIME_DIR}/tmux-scripts-latest.json`);

  const command = setupCommands.join("\n");

  const result = await instance.exec(`bash -lc ${singleQuote(command)}`);

  if (result.exit_code !== 0) {
    throw new Error(
      `Failed to prepare tmux scripts (exit ${result.exit_code}): ${
        result.stderr || result.stdout || "no output"
      }`,
    );
  }
}
