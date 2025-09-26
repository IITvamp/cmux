import {
  execFile,
  type ExecFileException,
} from "node:child_process";
import { promisify } from "node:util";

export type DockerStatus = "ok" | "not_installed" | "not_running";

const execFileAsync = promisify(execFile);

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const isTimeoutError = (error: ExecFileException) => {
  const timeoutCodes = new Set(["ETIMEDOUT", "ERR_CHILD_PROCESS_STDIO_TIMEOUT"]);
  return (
    timeoutCodes.has((error as NodeJS.ErrnoException).code ?? "") ||
    Boolean(error.killed && (error.signal === "SIGTERM" || error.signal === "SIGKILL"))
  );
};

export async function checkDockerStatus(): Promise<DockerStatus> {
  try {
    await execFileAsync("docker", ["--version"], { timeout: 5000 });
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === "ENOENT") {
      return "not_installed";
    }
    return "not_installed";
  }

  const maxAttempts = 3;
  const retryDelayMs = 2000;
  const infoTimeoutMs = 10_000;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await execFileAsync("docker", ["info"], {
        timeout: infoTimeoutMs,
      });
      return "ok";
    } catch (error) {
      const err = error as ExecFileException & NodeJS.ErrnoException;

      if (isTimeoutError(err) && attempt < maxAttempts - 1) {
        // Give Docker a moment to finish starting up before retrying.
        await sleep(retryDelayMs);
        continue;
      }

      return "not_running";
    }
  }

  return "not_running";
}
