const formatDockerError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message || "Unknown Docker error";
  }
  if (typeof error === "string" && error.length > 0) {
    return error;
  }
  return "Unknown Docker error";
};

export async function checkDockerStatus(): Promise<{
  isRunning: boolean;
  isInstalled: boolean;
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
  const execAsync = promisify(exec);

  let version: string | undefined;

  try {
    // Check if Docker binary is installed. This also returns the server version
    const { stdout: versionOutput } = await execAsync(
      "docker version --format '{{.Server.Version}}'"
    );
    version = versionOutput.trim();
  } catch (error) {
    return {
      isRunning: false,
      isInstalled: false,
      error: formatDockerError(error),
    };
  }

  try {
    // docker ps will fail if the daemon is stopped or unreachable
    await execAsync("docker ps");
  } catch (error) {
    return {
      isRunning: false,
      isInstalled: true,
      version,
      error: formatDockerError(error),
    };
  }

  const result: {
    isRunning: boolean;
    isInstalled: boolean;
    version?: string;
    workerImage?: {
      name: string;
      isAvailable: boolean;
      isPulling?: boolean;
    };
  } = {
    isRunning: true,
    isInstalled: true,
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
}
