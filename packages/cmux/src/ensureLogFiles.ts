import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import { convexDir } from "./cli";
import { logger } from "./logger";
import { pullDockerImage } from "./utils/dockerPull";

export function ensureLogFiles() {
  // ensure convexDir exists
  mkdirSync(convexDir, { recursive: true });

  // ensure logs directory exists
  const logsDir = path.join(convexDir, "logs");
  mkdirSync(logsDir, { recursive: true });

  const logFileNames = [
    "cmux-cli.log",
    "docker-vscode.log",
    "server.log",
    "docker-pull.log",
  ];
  // ensure all log files exist
  for (const logFileName of logFileNames) {
    const logFilePath = path.join(convexDir, "logs", logFileName);
    if (!existsSync(logFilePath)) {
      writeFileSync(logFilePath, "");
    } else {
      // empty the file if it's not empty
      writeFileSync(logFilePath, "");
    }
  }

  // Pull Docker image asynchronously if WORKER_IMAGE_NAME is set
  if (process.env.WORKER_IMAGE_NAME) {
    pullDockerImage(process.env.WORKER_IMAGE_NAME, logsDir);
  }

  // Check if convex directory exists
  if (!existsSync(convexDir)) {
    console.error("Convex directory not found at:", convexDir);
    process.exit(1);
  }

  logger.ensureLogDirectory();
}
