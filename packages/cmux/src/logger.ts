import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { appendFile, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
const LOG_DIR = path.join(homedir(), ".cmux", "logs");
const LOG_FILE = path.join(LOG_DIR, "cmux.log");

let isInitialized = false;

// Initialize logging directory and file
function ensureLoggerInitialized(): void {
  if (isInitialized) return;
  
  try {
    // Ensure log directory exists
    if (!existsSync(LOG_DIR)) {
      mkdirSync(LOG_DIR, { recursive: true });
    }

    // Make sure the log file exists
    if (!existsSync(LOG_FILE)) {
      writeFileSync(LOG_FILE, "");
    }
    
    isInitialized = true;
  } catch (error) {
    // If we can't create the log directory, just log to console
    console.error("Failed to initialize logger:", error);
  }
}

async function rotateLogIfNeeded(): Promise<void> {
  try {
    const stats = await stat(LOG_FILE);
    if (stats.size > MAX_LOG_SIZE) {
      // Rotate log file
      const timestamp = new Date().toISOString().replace(/:/g, "-");
      const rotatedFile = path.join(LOG_DIR, `cmux-${timestamp}.log`);
      const content = await readFile(LOG_FILE, "utf-8");
      await writeFile(rotatedFile, content);
      await writeFile(LOG_FILE, "");
    }
  } catch (error) {
    // File doesn't exist yet, that's ok
  }
}

export async function log(
  message: string,
  level: "info" | "error" | "warn" = "info"
): Promise<void> {
  ensureLoggerInitialized();
  
  await rotateLogIfNeeded();

  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

  try {
    await appendFile(LOG_FILE, logEntry);
  } catch (error) {
    // Fallback to console if logging fails
    console.error("Failed to write to log file:", error);
    console.log(message);
  }
}

export const logger = {
  info: (message: string) => log(message, "info"),
  error: (message: string) => log(message, "error"),
  warn: (message: string) => log(message, "warn"),
};
