import { exec as execCallback, spawn } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execCallback);
const SESSION_NAME = "claude-code-session";
const IDLE_TIMEOUT_MS = 3000; // 3 seconds of no output = idle

async function main() {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Script started`);

  // Kill any existing session
  try {
    await exec(`tmux kill-session -t ${SESSION_NAME}`);
  } catch (e) {
    // Session doesn't exist, that's fine
  }

  // Create new tmux session with Claude
  console.log(
    `[${new Date().toISOString()}] Creating tmux session with Claude...`
  );
  try {
    await exec(
      `tmux new-session -d -s ${SESSION_NAME} 'claude "what is the meaning of life"'`
    );
  } catch (e) {
    console.error("Failed to create tmux session:", e);
    process.exit(1);
  }

  // Give tmux a moment to start
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Spawn tmux attach with PTY allocation
  console.log(`[${new Date().toISOString()}] Attaching to tmux session...`);

  // Use 'script' command to allocate a PTY and run tmux attach
  const child = spawn(
    "script",
    ["-q", "/dev/null", "tmux", "attach-session", "-t", SESSION_NAME],
    {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, TERM: "xterm-256color" },
    }
  );

  let lastActivityTime = Date.now();
  let idleDetected = false;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const checkIdle = () => {
    if (Date.now() - lastActivityTime > IDLE_TIMEOUT_MS && !idleDetected) {
      const elapsedTime = Date.now() - startTime;
      console.log(`\n\n[${new Date().toISOString()}] TERMINAL IDLE`);
      console.log(
        `[${new Date().toISOString()}] Total time: ${elapsedTime}ms (${(
          elapsedTime / 1000
        ).toFixed(2)}s)`
      );
      idleDetected = true;

      // Detach from tmux (Ctrl+B, D)
      child.stdin.write("\x02"); // Ctrl+B
      child.stdin.write("d"); // d for detach

      if (idleTimer) {
        clearTimeout(idleTimer);
      }
    }
  };

  // Monitor stdout
  child.stdout.on("data", (data) => {
    // process.stdout.write(data);
    lastActivityTime = Date.now();
    console.log("[stdout]", data.toString().length);

    // Reset idle timer
    if (idleTimer) {
      clearTimeout(idleTimer);
    }
    idleTimer = setTimeout(checkIdle, IDLE_TIMEOUT_MS);
  });

  // Monitor stderr
  child.stderr.on("data", (data) => {
    // process.stderr.write(data);
    lastActivityTime = Date.now();
    console.log("[stderr]", data.toString().length);

    // Reset idle timer
    if (idleTimer) {
      clearTimeout(idleTimer);
    }
    idleTimer = setTimeout(checkIdle, IDLE_TIMEOUT_MS);
  });

  // Handle child process exit
  child.on("exit", (code, signal) => {
    console.log(
      `\n[${new Date().toISOString()}] Process exited with code ${code}, signal ${signal}`
    );

    if (!idleDetected) {
      console.log("Session ended before idle timeout");
    } else {
      console.log("\nSession is still active. You can reattach with:");
      console.log(`tmux attach-session -t ${SESSION_NAME}`);
    }

    if (idleTimer) {
      clearTimeout(idleTimer);
    }
    process.exit(0);
  });

  // Handle errors
  child.on("error", (err) => {
    console.error(`[${new Date().toISOString()}] Error:`, err);
    process.exit(1);
  });

  // Start the idle timer
  idleTimer = setTimeout(checkIdle, IDLE_TIMEOUT_MS);

  // Handle process termination
  process.on("SIGINT", () => {
    console.log(
      `\n[${new Date().toISOString()}] Received SIGINT, cleaning up...`
    );
    child.kill();
    process.exit(0);
  });
}

main().catch(console.error);
