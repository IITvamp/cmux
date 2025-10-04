import { exec as childProcessExec } from "node:child_process";
import { promisify } from "node:util";

import { ensureDockerDaemonReady } from "@cmux/shared";

export type DockerStatus = "ok" | "not_installed" | "not_running";

const execAsync = promisify(childProcessExec);

function describeExecError(error: unknown): string {
  if (!error) {
    return "Unknown error";
  }

  if (error instanceof Error) {
    const stderr = (error as Error & { stderr?: unknown }).stderr;
    if (typeof stderr === "string" && stderr.trim().length > 0) {
      return stderr.trim();
    }
    if (stderr instanceof Buffer && stderr.toString().trim().length > 0) {
      return stderr.toString().trim();
    }
    return error.message;
  }

  if (typeof error === "object") {
    const stderr = (error as { stderr?: unknown }).stderr;
    if (typeof stderr === "string" && stderr.trim().length > 0) {
      return stderr.trim();
    }
    if (stderr instanceof Buffer && stderr.toString().trim().length > 0) {
      return stderr.toString().trim();
    }
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
}

function isCliMissing(error: unknown): boolean {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return code === "ENOENT";
  }

  const message = describeExecError(error).toLowerCase();
  return message.includes("command not found") || message.includes("not recognized");
}

export async function checkDockerStatus(): Promise<DockerStatus> {
  try {
    await execAsync("docker --version");
  } catch (error) {
    return isCliMissing(error) ? "not_installed" : "not_running";
  }

  const readiness = await ensureDockerDaemonReady({ attempts: 8, delayMs: 500 });
  if (!readiness.ready) {
    return "not_running";
  }

  try {
    await execAsync("docker ps");
    return "ok";
  } catch (error) {
    if (isCliMissing(error)) {
      return "not_installed";
    }

    const retry = await ensureDockerDaemonReady({ attempts: 3, delayMs: 500 });
    if (!retry.ready) {
      return "not_running";
    }

    try {
      await execAsync("docker ps");
      return "ok";
    } catch {
      return "not_running";
    }
  }
}
