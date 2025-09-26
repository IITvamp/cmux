import path from "node:path";

const DOCKER_PATH_CANDIDATES =
  process.platform === "win32"
    ? [
        "C:\\Program Files\\Docker\\Docker\\resources\\bin",
        "C:\\Program Files\\Docker\\Docker\\resources",
        "C:\\Program Files\\Docker\\Docker",
      ]
    : [
        "/usr/local/bin",
        "/opt/homebrew/bin",
        "/Applications/Docker.app/Contents/Resources/bin",
        "/usr/bin",
        "/bin",
        "/usr/sbin",
        "/sbin",
      ];

function createDockerAwareEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  const delimiter = path.delimiter;
  const rawPath =
    env.PATH ?? env.Path ?? env.path ?? "";

  const segments = rawPath
    .split(delimiter)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  for (const candidate of DOCKER_PATH_CANDIDATES) {
    if (!segments.includes(candidate)) {
      segments.push(candidate);
    }
  }

  const nextPath = Array.from(new Set(segments)).join(delimiter);

  env.PATH = nextPath;
  env.Path = nextPath;
  env.path = nextPath;

  return env;
}

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

  const execOptions = { env: createDockerAwareEnv() };

  try {
    // Check if Docker is running
    const { stdout: versionOutput } = await execAsync(
      "docker version --format '{{.Server.Version}}'",
      execOptions
    );
    const version = versionOutput.trim();

    // Check if Docker daemon is accessible
    await execAsync("docker ps", execOptions);

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
        await execAsync(`docker image inspect ${imageName}`, execOptions);
        result.workerImage = {
          name: imageName,
          isAvailable: true,
        };
      } catch {
        // Image doesn't exist locally
        // Check if a pull is in progress
        try {
          const { stdout: psOutput } = await execAsync(
            "docker ps -a --format '{{.Command}}'",
            execOptions
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
