import { promisify } from "node:util";
import {
  exec,
  execFile,
  type ExecException,
  type ExecFileException,
} from "node:child_process";
import type { WorkerExec, WorkerExecResult } from "@cmux/shared";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const SHELL_COMMANDS = new Set(["bash", "/bin/bash", "sh", "/bin/sh"]);

export async function runWorkerExec(validated: WorkerExec): Promise<WorkerExecResult> {
  const execOptions = {
    cwd: validated.cwd || process.env.HOME || "/",
    env: { ...process.env, ...(validated.env || {}) },
    timeout: validated.timeout,
  } as const;

  try {
    if (SHELL_COMMANDS.has(validated.command)) {
      const shellArgs = validated.args ?? [];
      const { stdout, stderr } = await execFileAsync(
        validated.command,
        shellArgs,
        execOptions,
      );
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

    const err = execError as Partial<ExecException & ExecFileException> & {
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
