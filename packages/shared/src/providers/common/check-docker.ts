import { exec as childProcessExec } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access } from "node:fs/promises";
import { promisify } from "node:util";

const execAsync = promisify(childProcessExec);

const DOCKER_INFO_COMMAND = "docker info --format '{{json .ServerVersion}}'";
const DOCKER_VERSION_COMMAND = "docker version --format '{{.Server.Version}}'";

function getDockerSocketPath(): string | null {
  const explicitSocket = process.env.DOCKER_SOCKET;
  if (explicitSocket) {
    return explicitSocket;
  }

  const dockerHost = process.env.DOCKER_HOST;
  if (!dockerHost || dockerHost.startsWith("unix://")) {
    if (dockerHost && dockerHost.startsWith("unix://")) {
      return dockerHost.replace("unix://", "");
    }
    return "/var/run/docker.sock";
  }

  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableDockerError(error: unknown): boolean {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (code === "ENOENT") {
      return false;
    }
  }

  const message = describeExecError(error);
  const lower = message.toLowerCase();
  return (
    lower.includes("cannot connect to the docker daemon") ||
    lower.includes("is the docker daemon running") ||
    lower.includes("connection refused") ||
    lower.includes("bad file descriptor") ||
    lower.includes("dial unix") ||
    lower.includes("context deadline exceeded") ||
    lower.includes("no such host")
  );
}

function describeExecError(error: unknown): string {
  if (!error) {
    return "Unknown error";
  }

  if (error instanceof Error) {
    const stderr = (error as Error & { stderr?: unknown }).stderr;
    if (typeof stderr === "string" && stderr.trim().length > 0) {
      return stderr.trim();
    }
    if (stderr instanceof Buffer && stderr.toString().trim().length > 0) {
      return stderr.toString().trim();
    }
    return error.message;
  }

  if (typeof error === "object") {
    const stderr = (error as { stderr?: unknown }).stderr;
    if (typeof stderr === "string" && stderr.trim().length > 0) {
      return stderr.trim();
    }
    if (stderr instanceof Buffer && stderr.toString().trim().length > 0) {
      return stderr.toString().trim();
    }
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message.trim();
    }
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
}

function parseVersion(output: string): string | undefined {
  const trimmed = output.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "string") {
      return parsed;
    }
  } catch {
    // Fallback to raw trimmed output
  }
  return trimmed;
}

async function dockerSocketExists(): Promise<boolean> {
  const socketPath = getDockerSocketPath();
  if (!socketPath) {
    return true;
  }

  try {
    await access(socketPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDockerDaemonReady(options?: {
  attempts?: number;
  delayMs?: number;
}): Promise<{
  ready: boolean;
  version?: string;
  error?: string;
}> {
  const attempts = options?.attempts ?? 6;
  const delayMs = options?.delayMs ?? 500;

  let version: string | undefined;
  let lastError: string | undefined;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const { stdout } = await execAsync(DOCKER_INFO_COMMAND);
      version = parseVersion(stdout);
      return { ready: true, version };
    } catch (error) {
      lastError = describeExecError(error);
      if (!isRetryableDockerError(error) || attempt === attempts - 1) {
        return {
          ready: false,
          version,
          error: lastError,
        };
      }
      await delay(delayMs);
    }
  }

  return {
    ready: false,
    version,
    error: lastError,
  };
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
    // Ensure Docker CLI is installed
    await execAsync("docker --version");
  } catch (error) {
    return {
      isRunning: false,
      error:
        describeExecError(error) ||
        "Docker is not installed or not available in PATH",
    };
  }

  if (!(await dockerSocketExists())) {
    const socketPath = getDockerSocketPath();
    return {
      isRunning: false,
      error:
        socketPath === null
          ? "Unable to reach Docker host"
          : `Docker socket not accessible at ${socketPath}`,
    };
  }

  const readiness = await ensureDockerDaemonReady();
  if (!readiness.ready) {
    return {
      isRunning: false,
      error:
        readiness.error || "Docker daemon is not running or not accessible",
    };
  }

  try {
    await execAsync("docker ps");
  } catch (error) {
    return {
      isRunning: false,
      error:
        describeExecError(error) ||
        "Docker daemon is not responding to commands",
    };
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
    version: readiness.version,
  };

  if (!result.version) {
    try {
      const { stdout } = await execAsync(DOCKER_VERSION_COMMAND);
      result.version = parseVersion(stdout);
    } catch {
      // Ignore failure to parse version
    }
  }

  const imageName = process.env.WORKER_IMAGE_NAME || "cmux-worker:0.0.1";

  if (imageName) {
    try {
      await execAsync(`docker image inspect ${imageName}`);
      result.workerImage = {
        name: imageName,
        isAvailable: true,
      };
    } catch (error) {
      const errorMessage = describeExecError(error);
      if (errorMessage.toLowerCase().includes("no such image")) {
        result.workerImage = {
          name: imageName,
          isAvailable: false,
          isPulling: false,
        };
      } else {
        try {
          const { stdout } = await execAsync(
            "docker ps -a --format '{{.Command}}'"
          );
          const isPulling = stdout.includes(`pull ${imageName}`);

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
  }

  return result;
}
