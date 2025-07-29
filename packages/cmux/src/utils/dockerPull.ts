import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import path from "node:path";

export async function pullDockerImage(
  imageName: string,
  logsDir: string
): Promise<void> {
  console.log(`\x1b[32m✓\x1b[0m Docker image pull initiated: ${imageName}`);

  const dockerPullLogPath = path.join(logsDir, "docker-pull.log");
  const dockerPullLogStream = createWriteStream(dockerPullLogPath, {
    flags: "a",
  });

  // Write timestamp and start message
  const timestamp = new Date().toISOString();
  dockerPullLogStream.write(
    `\n[${timestamp}] Starting Docker pull for ${imageName}\n`
  );

  const pullProcess = spawn("docker", ["pull", imageName]);

  pullProcess.stdout.on("data", (data) => {
    dockerPullLogStream.write(`[STDOUT] ${data}`);
  });

  pullProcess.stderr.on("data", (data) => {
    dockerPullLogStream.write(`[STDERR] ${data}`);
  });

  pullProcess.on("close", (code) => {
    const endTimestamp = new Date().toISOString();
    if (code === 0) {
      const successMsg = `[${endTimestamp}] Docker image ${imageName} pulled successfully\n`;
      dockerPullLogStream.write(successMsg);
      console.log(
        `\x1b[32m✓\x1b[0m Docker image pull completed successfully (see logs at ${dockerPullLogPath})`
      );
    } else {
      const failMsg = `[${endTimestamp}] Docker image pull failed with code ${code} - image might be available locally\n`;
      dockerPullLogStream.write(failMsg);
      console.log(
        `\x1b[33m!\x1b[0m Docker image pull failed with code ${code} (see logs at ${dockerPullLogPath})`
      );
    }
    dockerPullLogStream.end();
  });

  pullProcess.on("error", (error) => {
    const errorTimestamp = new Date().toISOString();
    dockerPullLogStream.write(
      `[${errorTimestamp}] Failed to start Docker pull: ${error.message}\n`
    );
    dockerPullLogStream.end();
    console.error(
      `\x1b[31m✗\x1b[0m Failed to start Docker pull (see logs at ${dockerPullLogPath})`
    );
  });
}
