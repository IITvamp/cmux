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

  // Lightweight readiness probe that survives Docker Desktop restarts.
  // Pings the Docker daemon via the Unix socket instead of relying on the CLI.
  async function pingDockerSocket(timeoutMs = 1000): Promise<boolean> {
    try {
      const net = await import("node:net");
      return await new Promise<boolean>((resolve) => {
        let settled = false;
        const done = (ok: boolean) => {
          if (settled) return;
          settled = true;
          try {
            socket.destroy();
          } catch {}
          resolve(ok);
        };

        const socket = net.createConnection({ path: "/var/run/docker.sock" });
        socket.setTimeout(timeoutMs, () => done(false));
        socket.on("error", () => done(false));
        socket.on("connect", () => {
          // Minimal HTTP request to the Docker ping endpoint
          socket.write(
            "GET /_ping HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n"
          );
        });
        let buffer = "";
        socket.on("data", (chunk: Buffer) => {
          buffer += chunk.toString();
          // Look for HTTP 200 status; Docker responds with "OK" body
          if (buffer.startsWith("HTTP/1.1 200") || buffer.startsWith("HTTP/1.0 200")) {
            done(true);
          }
        });
        socket.on("end", () => done(false));
      });
    } catch {
      return false;
    }
  }

  try {
    // Prefer socket ping to determine daemon readiness (works even if CLI path/env is borked)
    const socketReady = await pingDockerSocket(1000);
    if (!socketReady) {
      return {
        isRunning: false,
        error: "Docker daemon is not reachable via /var/run/docker.sock",
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
    };

    // Try to obtain version info via CLI, but don't fail readiness if it errors
    try {
      const { stdout: versionOutput } = await execAsync(
        "docker version --format '{{.Server.Version}}'",
        { timeout: 3000, maxBuffer: 1024 * 1024 }
      );
      const version = versionOutput.trim();
      if (version) {
        result.version = version;
      }
    } catch {
      // Ignore version errors; daemon is reachable as verified above
    }

    // Check for worker image (use same default as DockerVSCodeInstance)
    const imageName = process.env.WORKER_IMAGE_NAME || "cmux-worker:0.0.1";
    if (imageName) {
      try {
        await execAsync(`docker image inspect ${imageName}`, {
          timeout: 3000,
          maxBuffer: 1024 * 1024,
        });
        result.workerImage = {
          name: imageName,
          isAvailable: true,
        };
      } catch {
        // Image doesn't exist locally; we do not attempt to detect "pulling" as it is
        // not represented as a container. Leave isPulling undefined/false.
        result.workerImage = {
          name: imageName,
          isAvailable: false,
          isPulling: false,
        };
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
