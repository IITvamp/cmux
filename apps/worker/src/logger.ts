import fs, { promises } from "node:fs";

const LOG_FILE = "/var/log/cmux/worker.log";

fs.mkdirSync("/var/log/cmux", { recursive: true });

export function log(
  level: string,
  message: string,
  data?: unknown,
  workerId?: string
) {
  const timestamp = new Date().toISOString();
  const workerIdStr = workerId ? `[${workerId}]` : "";
  const logEntry = `[${timestamp}]${workerIdStr} [${level}] ${message}${data ? ` ${JSON.stringify(data, null, 2)}` : ""}\n`;

  // Console log immediately
  console.log(logEntry.trim());

  // File log in background (fire and forget)
  promises.appendFile(LOG_FILE, logEntry).catch((error) => {
    console.error("Failed to write to log file:", error);
  });
}
