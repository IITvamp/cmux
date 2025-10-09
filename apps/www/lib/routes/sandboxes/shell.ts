import type {
  ExecOptions,
  Instance,
  InstanceExecResponse,
} from "morphcloud";

export const singleQuote = (value: string): string =>
  `'${value.replace(/'/g, "'\\''")}'`;

export const maskSensitive = (value: string): string =>
  value.replace(/:[^@]*@/g, ":***@");

const normalizeCommand = (command: string | string[]): string[] =>
  Array.isArray(command) ? command : ["/bin/bash", "-lc", command];

type ExecCapableInstance = Pick<Instance, "exec">;
type RootfsExecOptions = ExecOptions & {
  disableFallback?: boolean;
  forceRootfs?: boolean;
};

export const execInRootfs = (
  instance: ExecCapableInstance,
  command: string | string[],
  options?: RootfsExecOptions
): Promise<InstanceExecResponse> => {
  const commandParts = normalizeCommand(command);
  return instance.exec(commandParts, options);
};
