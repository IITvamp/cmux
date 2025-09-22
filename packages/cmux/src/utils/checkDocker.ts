import { spawnSync } from "node:child_process";

export type DockerStatus = "ok" | "not_installed" | "not_running";

export function checkDockerStatus(retries = 3): DockerStatus {
  // First check if Docker is installed
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

  // Check if Docker daemon is running with retry logic
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const info = spawnSync("docker", ["info"], {
        stdio: "ignore",
        timeout: 3000,
      });

      if (info.status === 0) {
        return "ok";
      }

      // If Docker is installed but daemon is not responding,
      // it might be restarting. Wait a bit before retrying.
      if (attempt < retries - 1) {
        // Wait 2 seconds between retries
        const waitTime = 2000;
        const start = Date.now();
        while (Date.now() - start < waitTime) {
          // Busy wait to avoid async in sync function
        }
      }
    } catch {
      // Continue to next retry
    }
  }

  return "not_running";
}

