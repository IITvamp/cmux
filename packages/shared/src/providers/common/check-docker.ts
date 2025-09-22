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
  const execAsync = promisify(exec);

  // Helper to execute with timeout
  const execWithTimeout = async (command: string, timeoutMs = 3000) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const result = await execAsync(command, { signal: controller.signal });
      clearTimeout(timeout);
      return result;
    } catch (error: any) {
      clearTimeout(timeout);
      if (error.name === 'AbortError' || error.code === 'ABORT_ERR') {
        throw new Error(`Command timed out after ${timeoutMs}ms: ${command}`);
      }
      throw error;
    }
  };

  try {
    // Check if Docker is running with timeout
    const { stdout: versionOutput } = await execWithTimeout(
      "docker version --format '{{.Server.Version}}'",
      3000
    );
    const version = versionOutput.trim();

    // Check if Docker daemon is accessible with timeout
    await execWithTimeout("docker ps", 3000);

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
    // More specific error handling
    let errorMessage = "Docker is not running or not installed";

    if (error instanceof Error) {
      if (error.message.includes("timed out")) {
        errorMessage = "Docker is not responding (may be restarting)";
      } else if (error.message.includes("Cannot connect to the Docker daemon")) {
        errorMessage = "Docker daemon is not running";
      } else if (error.message.includes("command not found") || error.message.includes("'docker' is not recognized")) {
        errorMessage = "Docker is not installed";
      } else {
        errorMessage = error.message;
      }
    }

    return {
      isRunning: false,
      error: errorMessage,
    };
  }
}
