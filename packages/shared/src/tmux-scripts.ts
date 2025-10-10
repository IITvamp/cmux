export const TMUX_RUNTIME_DIR = "/var/tmp/cmux-scripts";
export const CMUX_LOG_DIR = "/var/log/cmux";
export const CMUX_WORKSPACE_ROOT = "/root/workspace";

export type EnvironmentScriptMode = "oneshot" | "continuous";

export interface EnvironmentScriptEntry {
  id: string;
  name: string;
  scriptPath: string;
  workingDirectory: string;
  logPath: string;
  statusFile?: string;
  mode: EnvironmentScriptMode;
}

export interface EnvironmentScriptManifest {
  version: 1;
  namespace: string;
  scripts: EnvironmentScriptEntry[];
}

export const sanitizeScriptNamespace = (value: string): string => {
  return value.replace(/[^A-Za-z0-9_-]/g, "-");
};

export const scriptDirectoryForNamespace = (namespace: string): string =>
  `${TMUX_RUNTIME_DIR}/${namespace}`;

export const manifestPathForNamespace = (namespace: string): string =>
  `${scriptDirectoryForNamespace(namespace)}/tmux-scripts.json`;
