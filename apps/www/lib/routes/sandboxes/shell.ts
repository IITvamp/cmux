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
const ROOTFS_PROBE_TIMEOUT_MS = 5_000;
const ENABLE_ROOTFS_EXEC =
  typeof process !== "undefined" &&
  process.env.CMUX_ENABLE_ROOTFS_EXEC === "1";
const normalizeCommand = (command: string | string[]): string[] =>
  Array.isArray(command) ? command : ["/bin/bash", "-lc", command];

type ExecCapableInstance = Pick<Instance, "exec">;
type RootfsExecOptions = ExecOptions & {
  disableFallback?: boolean;
  forceRootfs?: boolean;
};
type ExecResult = InstanceExecResponse;

const rootfsSupportCache = new WeakMap<ExecCapableInstance, Promise<boolean>>();

const ensureRootfsSupport = (
  instance: ExecCapableInstance
): Promise<boolean> => {
  const cached = rootfsSupportCache.get(instance);
  if (cached) return cached;

  const probe = (async (): Promise<boolean> => {
    const envAssignments = Object.entries(DEFAULT_ROOTFS_ENV)
      .map(([key, value]) => `${key}=${singleQuote(value)}`)
      .join(" ");
    const script = [
      "set -euo pipefail",
      `if [ ! -x ${singleQuote(CMUX_ROOTFS_EXEC)} ]; then`,
      "  exit 127",
      "fi",
      `${envAssignments} ${singleQuote(CMUX_ROOTFS_EXEC)} /bin/true`,
    ].join("\n");
    try {
      const result = await instance.exec(
        ["/bin/bash", "-lc", script],
        { timeout: ROOTFS_PROBE_TIMEOUT_MS }
      );
      return result.exit_code === 0;
    } catch {
      return false;
    }
  })();

  rootfsSupportCache.set(instance, probe);
  return probe;
};

const immediateResult = (exitCode: number): ExecResult => ({
  stdout: "",
  stderr: "",
  exit_code: exitCode,
});

export const execInRootfs = async (
  instance: ExecCapableInstance,
  command: string | string[],
  options?: RootfsExecOptions,
  env: Record<string, string> = DEFAULT_ROOTFS_ENV
): Promise<InstanceExecResponse> => {
  const commandParts = normalizeCommand(command);
  const { disableFallback = false, forceRootfs = false, ...execOptions } =
    options ?? {};
  const wantsRootfs = forceRootfs || ENABLE_ROOTFS_EXEC;
  const supportsRootfs = wantsRootfs
    ? await ensureRootfsSupport(instance)
    : false;
  const envAssignments = Object.entries(env).map(
    ([key, value]) => `${key}=${value}`
  );
  const rootfsCommandParts = [
    "env",
    ...envAssignments,
    CMUX_ROOTFS_EXEC,
    ...commandParts,
  ];
  const rootfsCommand = rootfsCommandParts
    .map((part) => singleQuote(part))
    .join(" ");
  const fallbackCommand = commandParts
    .map((part) => singleQuote(part))
    .join(" ");
  if (!supportsRootfs) {
    if (disableFallback) {
      return immediateResult(127);
    }
    return typeof command === "string"
      ? instance.exec(command, execOptions)
      : instance.exec(commandParts, execOptions);
  }

  const script = disableFallback
    ? [
        "set -euo pipefail",
        `if [ -x ${singleQuote(CMUX_ROOTFS_EXEC)} ]; then`,
        `  exec ${rootfsCommand}`,
        "fi",
        "exit 127",
      ].join("\n")
    : [
        "set -euo pipefail",
        `if [ -x ${singleQuote(CMUX_ROOTFS_EXEC)} ]; then`,
        `  if ${rootfsCommand}; then`,
        "    exit 0",
        "  else",
        '    status=$?',
        '    if [ "$status" -ne 126 ] && [ "$status" -ne 127 ]; then',
        '      exit "$status"',
        "    fi",
        "  fi",
        "fi",
        `exec ${fallbackCommand}`,
      ].join("\n");

  return instance.exec(
    ["/bin/bash", "-lc", script],
    execOptions
  );
};
