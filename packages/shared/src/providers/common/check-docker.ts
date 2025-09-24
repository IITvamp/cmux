export async function checkDockerStatus(): Promise<{
  isRunning: boolean;
  isConfigured: boolean;
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

  const buildFailure = (configured: boolean, error: unknown) => ({
    isRunning: false,
    isConfigured: configured,
    ...(version ? { version } : {}),
    error:
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : configured
            ? "Docker daemon is not running"
            : "Docker is not installed or not accessible",
  });

  try {
    // Check if Docker CLI is available
    const { stdout: versionOutput } = await execAsync(
      "docker version --format '{{.Server.Version}}'"
    );
    version = versionOutput.trim();
  } catch (error) {
    return buildFailure(false, error);
  }

  try {
    // Check if Docker daemon is accessible
    await execAsync("docker ps");
  } catch (error) {
    return buildFailure(true, error);
  }

  const result: {
    isRunning: boolean;
    isConfigured: boolean;
    version?: string;
    workerImage?: {
      name: string;
      isAvailable: boolean;
      isPulling?: boolean;
    };
  } = {
    isRunning: true,
    isConfigured: true,
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
