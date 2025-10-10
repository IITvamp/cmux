import { promisify } from "node:util";
import { exec, type ExecException } from "node:child_process";
import type { WorkerExec, WorkerExecResult } from "@cmux/shared";

const execAsync = promisify(exec);

export async function runWorkerExec(validated: WorkerExec): Promise<WorkerExecResult> {
  const execOptions = {
    cwd: validated.cwd || process.env.HOME || "/",
    env: { ...process.env, ...(validated.env || {}) },
    timeout: validated.timeout,
  } as const;

  try {
    // If the caller asked for a specific shell with -c, execute using that shell
    if (
      (validated.command === "/bin/bash" ||
        validated.command === "bash" ||
        validated.command === "/bin/sh" ||
        validated.command === "sh") &&
      validated.args &&
      validated.args[0] === "-c"
    ) {
      const shellCommand = validated.args.slice(1).join(" ");
      const shellPath = validated.command;
      const { stdout, stderr } = await execAsync(shellCommand, {
        ...execOptions,
        shell: shellPath,
      });
      return { stdout: stdout || "", stderr: stderr || "", exitCode: 0 };
    }

    // Otherwise compose command + args as a single string
    const commandWithArgs = validated.args
      ? `${validated.command} ${validated.args.join(" ")}`
      : validated.command;
    const { stdout, stderr } = await execAsync(commandWithArgs, execOptions);
    return { stdout: stdout || "", stderr: stderr || "", exitCode: 0 };
  } catch (execError: unknown) {
    const isObj = (v: unknown): v is Record<string, unknown> =>
      typeof v === "object" && v !== null;

    const toString = (v: unknown): string => {
      if (typeof v === "string") return v;
      if (isObj(v) && "toString" in v && typeof v.toString === "function") {
        try {
          // Buffer and many objects provide sensible toString()
          return v.toString();
        } catch (_err) {
          return "";
        }
      }
      return "";
    };

    const err = execError as Partial<ExecException> & {
      stdout?: unknown;
      stderr?: unknown;
      code?: number | string;
      signal?: NodeJS.Signals;
    };

    const code = typeof err?.code === "number" ? err.code : 1;

    return {
      stdout: toString(err?.stdout),
      stderr: toString(err?.stderr),
      exitCode: code,
      signal: (err?.signal as string | undefined) ?? undefined,
    };
  }
}
