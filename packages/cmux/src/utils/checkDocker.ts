import { spawnSync } from "node:child_process";

export type DockerStatus = "ok" | "not_installed" | "not_running";

const DOCKER_VERSION_TIMEOUT_MS = 5_000;
const DOCKER_INFO_TIMEOUT_MS = 5_000;
const DOCKER_INFO_MAX_ATTEMPTS = 4;
const DOCKER_INFO_RETRY_DELAY_MS = 1_000;

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isNotInstalled(error: NodeJS.ErrnoException | null): boolean {
  if (!error) {
    return false;
  }
  return error.code === "ENOENT";
}

export function checkDockerStatus(): DockerStatus {
  try {
    const version = spawnSync("docker", ["--version"], {
      stdio: "ignore",
      timeout: DOCKER_VERSION_TIMEOUT_MS,
    });

    if (isNotInstalled(version.error as NodeJS.ErrnoException | null)) {
      return "not_installed";
    }

    if (version.status !== 0) {
      return "not_installed";
    }
  } catch {
    return "not_installed";
  }

  let attempt = 0;

  while (attempt < DOCKER_INFO_MAX_ATTEMPTS) {
    attempt += 1;

    try {
      const info = spawnSync("docker", ["info"], {
        stdio: "pipe",
        encoding: "utf-8",
        timeout: DOCKER_INFO_TIMEOUT_MS,
      });

      if (info.status === 0) {
        return "ok";
      }

      if (isNotInstalled(info.error as NodeJS.ErrnoException | null)) {
        return "not_installed";
      }

      const stderr = typeof info.stderr === "string" ? info.stderr : "";
      const looksLikeDaemonStarting = stderr
        .toLowerCase()
        .includes("docker daemon");
      const timedOut = Boolean(
        info.error &&
          (info.error as NodeJS.ErrnoException).code === "ETIMEDOUT"
      );

      if (attempt < DOCKER_INFO_MAX_ATTEMPTS && (looksLikeDaemonStarting || timedOut)) {
        sleep(DOCKER_INFO_RETRY_DELAY_MS);
        continue;
      }

      return "not_running";
    } catch (error) {
      const isInstalled = !isNotInstalled(error as NodeJS.ErrnoException | null);

      if (isInstalled && attempt < DOCKER_INFO_MAX_ATTEMPTS) {
        sleep(DOCKER_INFO_RETRY_DELAY_MS);
        continue;
      }

      return isInstalled ? "not_running" : "not_installed";
    }
  }

  return "not_running";
}
