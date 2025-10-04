type ExecFileError = import("node:child_process").ExecFileException &
  NodeJS.ErrnoException & {
    stdout?: string;
    stderr?: string;
  };

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_BUFFER = 1024 * 1024;

function isCommandMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function getProcessOutput(error: ExecFileError): string | undefined {
  const stderr = error.stderr?.trim();
  if (stderr) {
    return stderr;
  }
  const stdout = error.stdout?.trim();
  if (stdout) {
    return stdout;
  }
  return undefined;
}

function normalizeErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const execError = error as ExecFileError;
    const output = getProcessOutput(execError);
    if (output) {
      return output;
    }
    if (typeof execError.message === "string" && execError.message.length > 0) {
      return execError.message;
    }
  }
  return "Docker is not running or not installed";
}

function isDaemonUnavailable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const execError = error as ExecFileError;
  const message = getProcessOutput(execError) ?? execError.message ?? "";
  const lower = message.toLowerCase();
  return (
    lower.includes("cannot connect to the docker daemon") ||
    lower.includes("is the docker daemon running") ||
    lower.includes("error during connect") ||
    lower.includes("template parsing error")
  );
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
  const [{ execFile }, { promisify }] = await Promise.all([
    import("node:child_process"),
    import("node:util"),
  ]);

  const execFileAsync = promisify(execFile);

  const runDocker = async (
    args: string[],
  ): Promise<{ stdout: string; stderr: string }> => {
    return execFileAsync("docker", args, {
      timeout: DEFAULT_TIMEOUT_MS,
      maxBuffer: DEFAULT_MAX_BUFFER,
    });
  };

  try {
    // Verify the CLI is installed and accessible
    try {
      await runDocker(["--version"]);
    } catch (error) {
      if (isCommandMissing(error)) {
        return {
          isRunning: false,
          error:
            "Docker CLI not found in PATH. Install Docker Desktop or add docker to PATH.",
        };
      }
      return {
        isRunning: false,
        error: normalizeErrorMessage(error),
      };
    }

    let version: string | undefined;

    // Retrieve docker server version; distinguishes between installed vs running
    try {
      const { stdout } = await runDocker([
        "version",
        "--format",
        "{{.Server.Version}}",
      ]);
      const trimmed = stdout.trim();
      version = trimmed.length > 0 ? trimmed : undefined;
    } catch (error) {
      if (isDaemonUnavailable(error)) {
        return {
          isRunning: false,
          error: "Docker daemon is not running. Start Docker Desktop or your Docker service.",
        };
      }
      return {
        isRunning: false,
        error: normalizeErrorMessage(error),
      };
    }

    try {
      // Ensure daemon is reachable by running a lightweight ps call
      await runDocker(["ps", "--format", "{{.ID}}"]);
    } catch (error) {
      return {
        isRunning: false,
        error: normalizeErrorMessage(error),
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
      version,
    };

    const imageName = process.env.WORKER_IMAGE_NAME || "cmux-worker:0.0.1";
    if (imageName) {
      try {
        await runDocker(["image", "inspect", imageName]);
        result.workerImage = {
          name: imageName,
          isAvailable: true,
        };
      } catch (inspectError) {
        let isPulling = false;
        try {
          const { stdout } = await runDocker([
            "ps",
            "-a",
            "--format",
            "{{.Command}}",
          ]);
          isPulling = stdout.includes(`pull ${imageName}`);
        } catch {
          isPulling = false;
        }

        result.workerImage = {
          name: imageName,
          isAvailable: false,
          isPulling,
        };
      }
    }

    return result;
  } catch (error) {
    return {
      isRunning: false,
      error: normalizeErrorMessage(error),
    };
  }
}
