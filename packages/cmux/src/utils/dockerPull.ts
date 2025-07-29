import { spawn, execSync } from "node:child_process";
import { createWriteStream, appendFileSync } from "node:fs";
import path from "node:path";

function checkImageExists(imageName: string): boolean {
  try {
    execSync(`docker image inspect ${imageName}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export async function pullDockerImage(
  imageName: string,
  logsDir: string
): Promise<void> {
  const dockerPullLogPath = path.join(logsDir, "docker-pull.log");
  
  // Check if image already exists
  if (checkImageExists(imageName)) {
    const timestamp = new Date().toISOString();
    appendFileSync(dockerPullLogPath, `\n[${timestamp}] Docker image ${imageName} already exists locally\n`);
    return;
  }

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
    } else {
      const failMsg = `[${endTimestamp}] Docker image pull failed with code ${code} - image might be available locally\n`;
      dockerPullLogStream.write(failMsg);
    }
    dockerPullLogStream.end();
  });

  pullProcess.on("error", (error) => {
    const errorTimestamp = new Date().toISOString();
    dockerPullLogStream.write(
      `[${errorTimestamp}] Failed to start Docker pull: ${error.message}\n`
    );
    dockerPullLogStream.end();
  });
}
