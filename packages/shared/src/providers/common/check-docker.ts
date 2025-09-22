// Cache for Docker status to avoid excessive checks
let dockerStatusCache: {
  status: {
    isRunning: boolean;
    version?: string;
    error?: string;
    isStarting?: boolean;
    workerImage?: {
      name: string;
      isAvailable: boolean;
      isPulling?: boolean;
    };
  };
  timestamp: number;
} | null = null;

const DOCKER_STATUS_CACHE_TTL = 2000; // 2 seconds cache
const DOCKER_MAX_RETRIES = 3;
const DOCKER_RETRY_DELAYS = [500, 1000, 2000]; // Exponential backoff

export async function checkDockerStatus(): Promise<{
  isRunning: boolean;
  version?: string;
  error?: string;
  isStarting?: boolean;
  workerImage?: {
    name: string;
    isAvailable: boolean;
    isPulling?: boolean;
  };
}> {
  // Check cache first
  if (dockerStatusCache && Date.now() - dockerStatusCache.timestamp < DOCKER_STATUS_CACHE_TTL) {
    return dockerStatusCache.status;
  }

  const { exec } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execAsync = promisify(exec);

  // Helper to check Docker with retries
  async function checkDockerWithRetries(): Promise<{
    isRunning: boolean;
    version?: string;
    isStarting?: boolean;
  }> {
    let lastError: Error | null = null;

    for (let i = 0; i < DOCKER_MAX_RETRIES; i++) {
      try {
        // First check if Docker CLI is available
        await execAsync("which docker");

        // Try to get Docker version
        const { stdout: versionOutput } = await execAsync(
          "docker version --format '{{.Server.Version}}'",
          { timeout: 3000 }
        );
        const version = versionOutput.trim();

        // Verify daemon is accessible
        await execAsync("docker ps", { timeout: 3000 });

        return {
          isRunning: true,
          version,
        };
      } catch (error) {
        lastError = error as Error;

        // If this isn't the last retry, wait before trying again
        if (i < DOCKER_MAX_RETRIES - 1) {
          await new Promise(resolve => setTimeout(resolve, DOCKER_RETRY_DELAYS[i]));
        }
      }
    }

    // All retries failed - check if Docker might be starting
    if (lastError) {
      const errorMessage = lastError.message || '';

      // Check for signs that Docker is installed but not ready
      if (errorMessage.includes('Cannot connect to the Docker daemon') ||
          errorMessage.includes('docker daemon is not running') ||
          errorMessage.includes('connection refused')) {

        // Docker is installed but daemon is not ready - might be starting
        try {
          await execAsync("which docker");
          return {
            isRunning: false,
            isStarting: true, // Indicate Docker might be starting up
          };
        } catch {
          // Docker CLI not found
        }
      }
    }

    return {
      isRunning: false,
    };
  }

  try {
    const dockerCheck = await checkDockerWithRetries();

    if (!dockerCheck.isRunning) {
      const result = {
        isRunning: false,
        isStarting: dockerCheck.isStarting,
        error: dockerCheck.isStarting
          ? "Docker is starting up, please wait..."
          : "Docker is not running or not installed",
      };

      // Cache the result
      dockerStatusCache = {
        status: result,
        timestamp: Date.now(),
      };

      return result;
    }

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
      version: dockerCheck.version,
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

    // Cache successful result
    dockerStatusCache = {
      status: result,
      timestamp: Date.now(),
    };

    return result;
  } catch (error) {
    const result = {
      isRunning: false,
      error:
        error instanceof Error
          ? error.message
          : "Docker is not running or not installed",
    };

    // Cache error result
    dockerStatusCache = {
      status: result,
      timestamp: Date.now(),
    };

    return result;
  }
}

// Function to invalidate cache (useful when we know Docker status might have changed)
export function invalidateDockerStatusCache(): void {
  dockerStatusCache = null;
}
