import { exec as execCallback } from "node:child_process";
import { promisify } from "node:util";
import { log } from "./logger.js";

const exec = promisify(execCallback);

interface IdleDetectionOptions {
  sessionName: string;
  idleTimeoutMs?: number;
  pollIntervalMs?: number;
  onIdle?: () => void;
}

export async function detectTerminalIdle(
  options: IdleDetectionOptions
): Promise<{ elapsedMs: number; cleanup: () => Promise<void> }> {
  const {
    sessionName,
    idleTimeoutMs = 3000,
    pollIntervalMs = 100,
    onIdle,
  } = options;

  const startTime = Date.now();
  let lastActivityTime = Date.now();
  let idleDetected = false;
  let fileMonitor: NodeJS.Timeout;
  let idleChecker: NodeJS.Timeout;

  // Create a temporary file for piping
  const tmpFile = `/tmp/tmux-${sessionName}-${Date.now()}.log`;

  // Start piping tmux pane output to a file
  try {
    await exec(`tmux pipe-pane -t ${sessionName} -o "cat >> ${tmpFile}"`);
    log("INFO", `Piping tmux output to ${tmpFile}`, { sessionName });
  } catch (e) {
    log("ERROR", "Failed to set up pipe-pane", e);
    throw e;
  }

  // Monitor the file for changes
  let lastFileSize = 0;
  fileMonitor = setInterval(async () => {
    try {
      const { stdout } = await exec(`wc -c < ${tmpFile}`);
      const currentSize = parseInt(stdout.trim());

      if (currentSize > lastFileSize) {
        lastActivityTime = Date.now();
        log("DEBUG", `Activity detected`, {
          sessionName,
          bytes: currentSize - lastFileSize,
        });
        lastFileSize = currentSize;
      }
    } catch (e) {
      // File might not exist yet
    }
  }, pollIntervalMs);

  // Return a promise that resolves when idle is detected
  return new Promise((resolve) => {
    idleChecker = setInterval(async () => {
      if (Date.now() - lastActivityTime > idleTimeoutMs && !idleDetected) {
        const elapsedTime = Date.now() - startTime;
        log("INFO", "Terminal idle detected", {
          sessionName,
          elapsedMs: elapsedTime,
          elapsedSeconds: (elapsedTime / 1000).toFixed(2),
        });

        idleDetected = true;
        clearInterval(idleChecker);
        clearInterval(fileMonitor);

        // Stop piping
        try {
          await exec(`tmux pipe-pane -t ${sessionName}`);
        } catch (e) {
          // Ignore errors
        }

        // Callback if provided
        if (onIdle) {
          onIdle();
        }

        // Resolve with elapsed time and cleanup function
        resolve({
          elapsedMs: elapsedTime,
          cleanup: async () => {
            try {
              await exec(`rm -f ${tmpFile}`);
            } catch (e) {
              // Ignore errors
            }
          },
        });
      }
    }, pollIntervalMs);
  });
}
