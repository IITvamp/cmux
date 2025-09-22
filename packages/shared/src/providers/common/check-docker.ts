import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const DOCKER_COMMAND_TIMEOUT_MS = 5000;

type ExecError = Error & {
  stdout?: string;
  stderr?: string;
  code?: number | null;
  killed?: boolean;
  signal?: NodeJS.Signals | null;
};

async function runDockerCommand(command: string) {
  return execAsync(command, {
    timeout: DOCKER_COMMAND_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
  });
}

function formatDockerError(error: unknown): string {
  if (error && typeof error === "object") {
    const execError = error as ExecError;
    if (execError.killed) {
      return "Docker command timed out. Docker may still be starting.";
    }
    if (execError.stderr && execError.stderr.trim().length > 0) {
      return execError.stderr.trim();
    }
    if (execError.stdout && execError.stdout.trim().length > 0) {
      return execError.stdout.trim();
    }
  }
  return error instanceof Error
    ? error.message
    : "Docker is not running or not installed";
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
  try {
    // Adding a timeout ensures we do not hang indefinitely while Docker restarts
    const { stdout: versionOutput } = await runDockerCommand(
      "docker version --format '{{.Server.Version}}'"
    );
    const version = versionOutput.trim();

    await runDockerCommand("docker ps");

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

    const imageName = process.env.WORKER_IMAGE_NAME || "cmux-worker:0.0.1";
    if (imageName) {
      try {
        await runDockerCommand(`docker image inspect ${imageName}`);
        result.workerImage = {
          name: imageName,
          isAvailable: true,
        };
      } catch {
        try {
          const { stdout: psOutput } = await runDockerCommand(
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
      error: formatDockerError(error),
    };
  }
}
