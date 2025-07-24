import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { log } from "./logger.js";

interface IdleDetectionOptions {
  sessionName: string;
  idleTimeoutMs?: number;
  onIdle?: () => void;
}

// Helper function to check if tmux session exists
async function waitForTmuxSession(
  sessionName: string,
  maxRetries = 10,
  delayMs = 100
): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await new Promise<boolean>((resolve) => {
        const checkProcess = spawn("tmux", ["has-session", "-t", sessionName]);

        checkProcess.on("exit", (code) => {
          resolve(code === 0);
        });

        checkProcess.on("error", () => {
          resolve(false);
        });
      });

      if (result) {
        log(
          "INFO",
          `Tmux session '${sessionName}' is ready after ${i + 1} attempts`
        );
        return;
      }

      if (i < maxRetries - 1) {
        log(
          "DEBUG",
          `Tmux session '${sessionName}' not ready, retrying in ${delayMs}ms... (attempt ${
            i + 1
          }/${maxRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      log("ERROR", `Error checking tmux session`, { error, attempt: i + 1 });
    }
  }

  log(
    "ERROR",
    `Tmux session '${sessionName}' not found after ${maxRetries} attempts`
  );
  throw new Error(
    `Tmux session '${sessionName}' not found after ${maxRetries} attempts`
  );
}

export async function detectTerminalIdle(
  options: IdleDetectionOptions
): Promise<{ elapsedMs: number }> {
  const { sessionName, idleTimeoutMs = 5000, onIdle } = options;

  const startTime = Date.now();
  let lastActivityTime = Date.now();
  let idleDetected = false;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let child: ChildProcessWithoutNullStreams;

  return new Promise(async (resolve, reject) => {
    // Poll tmux session to see if it's ready, retry up to 10 times with 100ms delay
    try {
      await waitForTmuxSession(sessionName);
    } catch (error) {
      reject(error);
      return;
    }

    // Use 'script' command to allocate a PTY and attach to tmux session
    try {
      child = spawn(
        "script",
        ["-q", "/dev/null", "tmux", "attach-session", "-t", sessionName],
        {
          stdio: ["pipe", "pipe", "pipe"],
          env: { ...process.env, TERM: "xterm-256color" },
        }
      );
    } catch (error) {
      log("ERROR", "Failed to spawn script process", error);
      reject(error);
      return;
    }

    const checkIdle = () => {
      if (Date.now() - lastActivityTime > idleTimeoutMs && !idleDetected) {
        const elapsedTime = Date.now() - startTime;
        log("INFO", "Terminal idle detected", {
          sessionName,
          elapsedMs: elapsedTime,
          elapsedSeconds: (elapsedTime / 1000).toFixed(2),
        });

        idleDetected = true;

        // Detach from tmux (Ctrl+B, D)
        child.stdin.write("\x02"); // Ctrl+B
        child.stdin.write("d"); // d for detach

        if (idleTimer) {
          clearTimeout(idleTimer);
        }

        // Callback if provided
        if (onIdle) {
          onIdle();
        }

        resolve({
          elapsedMs: elapsedTime,
        });
      }
    };

    // Monitor stdout
    child.stdout.on("data", (data) => {
      lastActivityTime = Date.now();
      log("DEBUG", `Activity detected on stdout`, {
        sessionName,
        bytes: data.length,
      });

      // Reset idle timer
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
      idleTimer = setTimeout(checkIdle, idleTimeoutMs);
    });

    // Monitor stderr
    child.stderr.on("data", (data) => {
      lastActivityTime = Date.now();
      log("DEBUG", `Activity detected on stderr`, {
        sessionName,
        bytes: data.length,
      });

      // Reset idle timer
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
      idleTimer = setTimeout(checkIdle, idleTimeoutMs);
    });

    // Handle child process exit
    child.on("exit", (code, signal) => {
      log("INFO", `Script process exited`, {
        sessionName,
        code,
        signal,
      });

      if (idleTimer) {
        clearTimeout(idleTimer);
      }

      if (!idleDetected) {
        // Session ended before idle timeout
        const elapsedTime = Date.now() - startTime;
        resolve({
          elapsedMs: elapsedTime,
        });
      }
    });

    // Handle errors
    child.on("error", (err) => {
      log("ERROR", `Script process error`, {
        sessionName,
        error: err,
      });
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
      reject(err);
    });

    // Start the idle timer
    idleTimer = setTimeout(checkIdle, idleTimeoutMs);
  });
}
