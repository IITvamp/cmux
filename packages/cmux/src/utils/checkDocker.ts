import { spawnSync } from "node:child_process";

export type DockerStatus = "ok" | "not_installed" | "not_running";

export function checkDockerStatus(): DockerStatus {
  try {
    const version = spawnSync("docker", ["--version"], {
      stdio: "ignore",
      timeout: 1500,
    });
    if (version.error) {
      return "not_installed";
    }
    if (version.status !== 0) {
      return "not_installed";
    }
  } catch {
    return "not_installed";
  }

  try {
    const info = spawnSync("docker", ["info"], {
      stdio: "ignore",
      timeout: 3000,
    });
    if (info.status === 0) {
      return "ok";
    }
    return "not_running";
  } catch {
    return "not_running";
  }
}

