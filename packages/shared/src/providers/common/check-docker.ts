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
  // Prefer checking via Docker UNIX socket to avoid relying on docker CLI availability.
  // Falls back to CLI checks if the socket is not accessible.

  type VersionResponse = {
    Version?: string;
  };

  const socketPath = "/var/run/docker.sock";
  const imageName = process.env.WORKER_IMAGE_NAME || "cmux-worker:0.0.1";

  const httpGet = async (
    path: string
  ): Promise<{ ok: boolean; statusCode: number; body: string }> => {
    const { request } = await import("node:http");
    return await new Promise((resolve) => {
      const req = request(
        {
          socketPath,
          path,
          method: "GET",
          timeout: 1000,
        },
        (res) => {
          const statusCode = res.statusCode ?? 0;
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            const body = Buffer.concat(chunks).toString("utf8");
            resolve({ ok: statusCode >= 200 && statusCode < 300, statusCode, body });
          });
        }
      );

      req.on("timeout", () => {
        req.destroy();
        resolve({ ok: false, statusCode: 0, body: "" });
      });
      req.on("error", () => {
        resolve({ ok: false, statusCode: 0, body: "" });
      });
      req.end();
    });
  };

  // First attempt: ping the Docker daemon via the UNIX socket
  const ping = await httpGet("/_ping");
  if (ping.ok && (ping.body.trim() === "OK" || ping.statusCode === 200)) {
    // Daemon is up; fetch version via socket
    let version: string | undefined;
    const versionRes = await httpGet("/version");
    if (versionRes.ok) {
      try {
        const parsed: VersionResponse = JSON.parse(versionRes.body);
        if (typeof parsed.Version === "string") {
          version = parsed.Version;
        }
      } catch {
        // Ignore JSON parse errors; leave version undefined
      }
    }

    // Check worker image via socket
    let workerImage: { name: string; isAvailable: boolean; isPulling?: boolean } | undefined;
    if (imageName) {
      const img = await httpGet(`/images/${encodeURIComponent(imageName)}/json`);
      if (img.ok) {
        workerImage = { name: imageName, isAvailable: true };
      } else if (img.statusCode === 404) {
        workerImage = { name: imageName, isAvailable: false, isPulling: false };
      }
    }

    return {
      isRunning: true,
      version,
      workerImage,
    };
  }

  // Fallback: use docker CLI for environments without socket access
  try {
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(exec);

    // Check if Docker CLI can report server version
    const { stdout: versionOutput } = await execAsync(
      "docker version --format '{{.Server.Version}}'"
    );
    const version = versionOutput.trim();

    // Check daemon reachability
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

    if (imageName) {
      try {
        await execAsync(`docker image inspect ${imageName}`);
        result.workerImage = {
          name: imageName,
          isAvailable: true,
        };
      } catch {
        // Image doesn't exist locally
        result.workerImage = {
          name: imageName,
          isAvailable: false,
          // We cannot reliably detect "pulling" state via CLI here without parsing events
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
