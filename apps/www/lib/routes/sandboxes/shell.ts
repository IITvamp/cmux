import type {
  ExecOptions,
  Instance,
  InstanceExecResponse,
} from "morphcloud";

export const singleQuote = (value: string): string =>
  `'${value.replace(/'/g, "'\\''")}'`;

export const maskSensitive = (value: string): string =>
  value.replace(/:[^@]*@/g, ":***@");

const CMUX_ROOTFS_EXEC = "/usr/local/lib/cmux/cmux-rootfs-exec";
const DEFAULT_ROOTFS_ENV: Record<string, string> = {
  CMUX_ROOTFS: "/opt/app/rootfs",
  CMUX_RUNTIME_ROOT: "/opt/app/runtime",
  CMUX_OVERLAY_UPPER: "/opt/app/overlay/upper",
  CMUX_OVERLAY_WORK: "/opt/app/overlay/work",
};

const toAnsiCQuoted = (value: string): string =>
  `$'${value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")}'`;

const asArray = (command: string | string[]): string[] =>
  Array.isArray(command)
    ? command
    : ["/bin/bash", "-lc", toAnsiCQuoted(command)];

const buildRootfsExecArgs = (
  command: string | string[],
  env: Record<string, string>
): string[] => {
  const envAssignments = Object.entries(env).map(
    ([key, value]) => `${key}=${value}`
  );
  return [
    "env",
    ...envAssignments,
    CMUX_ROOTFS_EXEC,
    ...asArray(command),
  ];
};

type ExecCapableInstance = Pick<Instance, "exec">;

export const execInRootfs = (
  instance: ExecCapableInstance,
  command: string | string[],
  options?: ExecOptions,
  env: Record<string, string> = DEFAULT_ROOTFS_ENV
): Promise<InstanceExecResponse> => {
  return instance.exec(buildRootfsExecArgs(command, env), options);
};
