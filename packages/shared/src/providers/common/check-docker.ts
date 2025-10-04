export async function checkDockerStatus(): Promise<{
  isRunning: boolean;
  version?: string;
  error?: string;
  workerImage?: {
    name: string;
    isAvailable: boolean;
    isPulling?: boolean;
  };
}> {
  const { exec } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { access, constants } = await import("node:fs/promises");
  const execAsync = promisify(exec);

  try {
    // First, check if Docker socket exists and is accessible
    try {
      await access("/var/run/docker.sock", constants.F_OK);
    } catch {
      return {
        isRunning: false,
        error: "Docker socket not found at /var/run/docker.sock",
      };
    }

    // Check if Docker daemon is responsive with a simple ping
    try {
      await execAsync("docker info --format '{{.ServerVersion}}'", {
        timeout: 3000,
      });
    } catch (error) {
      return {
        isRunning: false,
        error:
          error instanceof Error
            ? `Docker daemon not responding: ${error.message}`
            : "Docker daemon not responding",
      };
    }

    // Check if Docker is running
    const { stdout: versionOutput } = await execAsync(
      "docker version --format '{{.Server.Version}}'"
    );
    const version = versionOutput.trim();

    // Check if Docker daemon is accessible
    await execAsync("docker ps");

    const result: {
      isRunning: boolean;
      version?: string;
      workerImage?: {
        name: string;
        isAvailable: boolean;
        isPulling?: boolean;
      };
    } = {
      isRunning: true,
      version,
    };

    // Check for worker image (use same default as DockerVSCodeInstance)
    const imageName = process.env.WORKER_IMAGE_NAME || "cmux-worker:0.0.1";
    if (imageName) {
      try {
        // Check if image exists locally
        await execAsync(`docker image inspect ${imageName}`);
        result.workerImage = {
          name: imageName,
          isAvailable: true,
        };
      } catch {
        // Image doesn't exist locally
        // Check if a pull is in progress
        try {
          const { stdout: psOutput } = await execAsync(
            "docker ps -a --format '{{.Command}}'"
          );
          const isPulling = psOutput.includes(`pull ${imageName}`);

          result.workerImage = {
            name: imageName,
            isAvailable: false,
            isPulling,
          };
        } catch {
          result.workerImage = {
            name: imageName,
            isAvailable: false,
            isPulling: false,
          };
        }
      }
    }

    return result;
  } catch (error) {
    return {
      isRunning: false,
      error:
        error instanceof Error
          ? error.message
          : "Docker is not running or not installed",
    };
  }
}
