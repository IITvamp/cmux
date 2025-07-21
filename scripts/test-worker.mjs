import { execSync, spawn } from "child_process";
import fs from "fs";
import { io } from "socket.io-client";
import { setTimeout as delay } from "timers/promises";

const CONTAINER_NAME = "coderouter-worker-test-2";
const IMAGE_NAME = "coderouter-worker:0.0.1";

// Parse command line arguments
const args = process.argv.slice(2);
const keepAlive = args.includes("--keep-alive") || args.includes("-k");

// Parse workspace path argument
let workspacePath = null;
const workspaceIndex = args.findIndex(
  (arg) => arg === "--workspace" || arg === "--workspace-path"
);
if (workspaceIndex !== -1 && workspaceIndex + 1 < args.length) {
  workspacePath = args[workspaceIndex + 1];

  // Validate workspace path exists
  try {
    if (!fs.existsSync(workspacePath)) {
      console.error(`❌ Workspace path does not exist: ${workspacePath}`);
      process.exit(1);
    }
    const stats = fs.statSync(workspacePath);
    if (!stats.isDirectory()) {
      console.error(`❌ Workspace path is not a directory: ${workspacePath}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(
      `❌ Cannot access workspace path: ${workspacePath}`,
      error.message
    );
    process.exit(1);
  }
}

// Parse prompt argument
let customPrompt = null;
const promptIndex = args.findIndex((arg) => arg === "--prompt" || arg === "-p");
if (promptIndex !== -1 && promptIndex + 1 < args.length) {
  customPrompt = args[promptIndex + 1];
}

// Timing utilities
const timings = {
  testStart: 0,
  phases: {},
  current: null,
};

function startTiming(phase) {
  const now = Date.now();
  if (timings.testStart === 0) {
    timings.testStart = now;
  }

  timings.current = phase;
  timings.phases[phase] = { start: now, end: null, duration: null };
  console.log(
    `⏱️  [${formatElapsed(now - timings.testStart)}] Starting: ${phase}`
  );
}

function endTiming(phase = timings.current) {
  const now = Date.now();
  if (!timings.phases[phase]) {
    console.warn(`Warning: No timing started for phase: ${phase}`);
    return;
  }

  timings.phases[phase].end = now;
  timings.phases[phase].duration = now - timings.phases[phase].start;

  console.log(
    `✅ [${formatElapsed(now - timings.testStart)}] Completed: ${phase} (${formatDuration(timings.phases[phase].duration)})`
  );

  if (timings.current === phase) {
    timings.current = null;
  }
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatElapsed(ms) {
  return formatDuration(ms);
}

function logProgress(message) {
  const elapsed = Date.now() - timings.testStart;
  console.log(`⏱️  [${formatElapsed(elapsed)}] ${message}`);
}

function printTimingSummary() {
  console.log("\n📊 TIMING SUMMARY");
  console.log("================");

  const totalTime = Date.now() - timings.testStart;
  console.log(`Total test time: ${formatDuration(totalTime)}\n`);

  const sortedPhases = Object.entries(timings.phases).sort(
    ([, a], [, b]) => a.start - b.start
  );

  for (const [phase, timing] of sortedPhases) {
    if (timing.duration !== null) {
      const percentage = ((timing.duration / totalTime) * 100).toFixed(1);
      console.log(
        `  ${phase.padEnd(30)} ${formatDuration(timing.duration).padEnd(8)} (${percentage}%)`
      );
    } else {
      console.log(`  ${phase.padEnd(30)} ${"INCOMPLETE".padEnd(8)}`);
    }
  }
  console.log("");
}

// Build and run Docker container
async function setupDockerContainer() {
  startTiming("Docker Setup");
  console.log("\n=== DOCKER SETUP ===");

  startTiming("Docker Build");
  console.log(`Building Docker image: ${IMAGE_NAME}...`);
  console.log("This may take a few minutes on first run...");

  try {
    // Build for the native platform (no --platform flag)
    execSync(`docker build -t ${IMAGE_NAME} --platform=linux/amd64 .`, {
      stdio: "inherit",
      cwd: process.cwd(),
    });
    endTiming("Docker Build");
    logProgress(`Docker image '${IMAGE_NAME}' built successfully`);
  } catch (error) {
    console.error("\n✗ Failed to build Docker image:", error);
    endTiming("Docker Build");
    process.exit(1);
  }

  // Stop and remove any existing container
  startTiming("Container Cleanup");
  logProgress("Cleaning up any existing containers...");
  try {
    execSync(`docker stop ${CONTAINER_NAME} 2>/dev/null || true`);
    execSync(`docker rm ${CONTAINER_NAME} 2>/dev/null || true`);
    endTiming("Container Cleanup");
    logProgress("Cleanup complete");
  } catch (error) {
    endTiming("Container Cleanup");
    // Ignore errors if container doesn't exist
  }

  startTiming("Container Start");
  logProgress(`Starting Docker container: ${CONTAINER_NAME}`);
  console.log("Container configuration:");
  console.log(
    "  - Port 2377: Worker port (with /client and /management namespaces)"
  );
  console.log("  - Port 2378: VS Code extension socket server");
  console.log("  - Port 2376: code-server (VS Code in browser)");
  console.log("  - Privileged mode: Enabled (for Docker-in-Docker)");

  if (workspacePath) {
    console.log(`  - Workspace mount: ${workspacePath} -> /root/workspace`);
  }

  if (customPrompt) {
    console.log(`  - prompt: ${customPrompt}`);
  }

  // Build docker run arguments
  const dockerArgs = [
    "run",
    "--rm",
    "--name",
    CONTAINER_NAME,
    "--privileged",
    "-p",
    "2377:2377",
    "-p",
    "2378:2378",
    "-p",
    "2376:2376",
    "-e",
    "NODE_ENV=production",
    "-e",
    "WORKER_PORT=2377",
  ];

  // Add volume mount if workspace path is provided
  if (workspacePath) {
    dockerArgs.push("-v", `${workspacePath}:/root/workspace`);
  }

  dockerArgs.push(IMAGE_NAME);

  const dockerRun = spawn("docker", dockerArgs, {
    stdio: "inherit",
  });

  dockerRun.on("error", (error) => {
    console.error("\n✗ Failed to start Docker container:", error);
    endTiming("Container Start");
    process.exit(1);
  });

  // Wait for container to be ready
  startTiming("Container Readiness Check");
  logProgress("Waiting for container to be ready...");
  logProgress("Checking container health...");

  // Give container time to start up before checking
  logProgress("Waiting for worker to start inside container...");
  // await delay(10000);

  // Check if container is running with retry logic
  let containerRunning = false;
  let retries = 0;
  const maxRetries = 30; // 30 retries = ~30 seconds

  while (!containerRunning && retries < maxRetries) {
    try {
      const containerCheck = execSync(`docker ps | grep ${CONTAINER_NAME}`, {
        encoding: "utf8",
      });
      if (containerCheck.trim()) {
        containerRunning = true;
        logProgress("Container is running and ready");
      } else {
        throw new Error("Container not found in docker ps output");
      }
    } catch (e) {
      retries++;
      if (retries >= maxRetries) {
        console.error("\n✗ Container failed to start after maximum retries");
        console.log("\nChecking container logs:");
        try {
          const logs = execSync(`docker logs ${CONTAINER_NAME} --tail 50`, {
            encoding: "utf8",
          });
          console.log(logs);
        } catch (logError) {
          console.error("Could not get container logs");
        }
        endTiming("Container Readiness Check");
        endTiming("Container Start");
        endTiming("Docker Setup");
        process.exit(1);
      }

      logProgress(
        `Container not ready yet, retrying... (${retries}/${maxRetries})`
      );
      await delay(1000); // Wait 1 second between retries
    }
  }

  endTiming("Container Readiness Check");
  endTiming("Container Start");
  logProgress("Container is running");
  logProgress("Docker readiness will be checked via Socket.IO...");
  endTiming("Docker Setup");

  return dockerRun;
}

// Helper to promisify socket events
function waitForEvent(socket, eventName, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeout);

    socket.once(eventName, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

// Test socket connections
async function testWorker() {
  let testTimeout;

  startTiming("Worker Test");

  // Set overall test timeout
  testTimeout = setTimeout(() => {
    console.error("\n❌ Test timed out after 60 seconds");
    console.log("\nChecking container status and logs...");
    try {
      execSync(`docker logs ${CONTAINER_NAME} --tail 100`, {
        stdio: "inherit",
      });
    } catch (e) {}
    cleanup();
  }, 60000);

  const clearTestTimeout = () => {
    if (testTimeout) {
      clearTimeout(testTimeout);
      testTimeout = null;
    }
  };

  console.log("=== SOCKET CONNECTION TEST ===\n");

  // Connect to worker management port
  startTiming("Socket Connection");
  logProgress("Connecting to worker management namespace...");
  const managementSocket = io("http://localhost:2377/management", {
    timeout: 10000,
    reconnectionAttempts: 3,
  });

  // Set up management socket event handlers before connecting
  let registrationData;
  const registrationPromise = new Promise((resolve) => {
    managementSocket.on("worker:register", (data) => {
      registrationData = data;
      resolve(data);
    });
  });

  // Also test client connection
  logProgress("Connecting to worker client namespace...");
  const clientSocket = io("http://localhost:2377/vscode", {
    timeout: 10000,
    reconnectionAttempts: 3,
  });

  // Set up client socket listeners
  clientSocket.on("connect", () => {
    logProgress("Connected to worker client port");
  });

  clientSocket.on("terminal-created", (data) => {
    logProgress("Client notification: Terminal created");
    console.log("  Details:", data);
  });

  clientSocket.on("terminal-output", (data) => {
    logProgress("Client notification: Terminal output");
    console.log("  Output:", data.data);
  });

  try {
    // Wait for connection
    await new Promise((resolve, reject) => {
      managementSocket.on("connect", resolve);
      managementSocket.on("connect_error", (error) => {
        console.error(
          "\n❌ Failed to connect to management port:",
          error.message
        );
        console.log(
          "\nTip: Check if the worker is running properly with: docker logs " +
            CONTAINER_NAME
        );
        reject(error);
      });
    });

    endTiming("Socket Connection");
    logProgress("Connected to worker management port");

    // Check Docker readiness
    startTiming("Docker-in-Docker Check");
    logProgress("Checking Docker-in-Docker readiness...");
    let dockerReady = false;
    let retries = 0;
    const maxRetries = 12; // 60 seconds total

    while (!dockerReady && retries < maxRetries) {
      const response = await new Promise((resolve) => {
        managementSocket.emit("worker:check-docker", (response) => {
          resolve(response);
        });
      });
      dockerReady = response.ready;

      if (dockerReady) {
        logProgress("Docker-in-Docker is ready: " + response.message);
      } else {
        retries++;
        logProgress(`Docker not ready yet: ${response.message}`);
        logProgress(`Retrying in 5 seconds... (${retries}/${maxRetries})`);
        await delay(5000);
      }
    }

    if (!dockerReady) {
      throw new Error("Docker failed to become ready after 60 seconds");
    }

    endTiming("Docker-in-Docker Check");

    // Wait for worker registration (handler was set up before connect)
    startTiming("Worker Registration");
    const workerData = await Promise.race([
      registrationPromise,
      delay(5000).then(() => {
        throw new Error("Timeout waiting for worker registration");
      }),
    ]);

    endTiming("Worker Registration");
    logProgress("Worker registered with ID: " + workerData.workerId);
    console.log("  Capabilities:", workerData.capabilities);

    // Create a terminal via worker
    startTiming("Terminal Creation");
    logProgress("Creating terminal via worker...");

    const terminalId = `test-terminal-${Date.now()}`;
    const testCommand = customPrompt || 'echo "Hello from worker terminal!"';

    // Track terminal output
    let terminalOutput = "";
    clientSocket.on("terminal-output", (data) => {
      if (data.terminalId === terminalId) {
        terminalOutput += data.data;
        // Print terminal output line by line
        const lines = data.data.split("\n").filter((line) => line.trim());
        lines.forEach((line) => {
          console.log(`  [Terminal ${terminalId}] ${line}`);
        });
      }
    });

    // Request terminal creation from main server
    managementSocket.emit("worker:create-terminal", {
      terminalId,
      cols: 80,
      rows: 24,
      cwd: workspacePath ? "/root/workspace" : undefined,
      command: "/bin/bash",
      args: ["-c", testCommand],
    });

    // Wait for terminal creation confirmation
    await new Promise((resolve, reject) => {
      managementSocket.once("worker:terminal-created", (data) => {
        if (data.terminalId === terminalId) {
          logProgress(`Terminal created successfully: ${terminalId}`);
          resolve(data);
        }
      });

      managementSocket.once("worker:error", (data) => {
        reject(new Error(`Failed to create terminal: ${data.error}`));
      });

      setTimeout(() => {
        reject(new Error("Timeout waiting for terminal creation"));
      }, 10000);
    });

    endTiming("Terminal Creation");

    // Wait a bit for command output
    logProgress("Waiting for terminal output...");
    // await delay(3000);

    // Connect to VS Code extension socket server (if terminal was created)
    if (customPrompt) {
      startTiming("VS Code Socket Connection");
      logProgress("Connecting to VS Code extension socket server (2378)...");

      const vscodeSocket = io("http://localhost:2378", {
        timeout: 10000,
        reconnectionAttempts: 3,
      });

      try {
        // Wait for connection
        await new Promise((resolve, reject) => {
          vscodeSocket.on("connect", () => {
            logProgress("Connected to VS Code extension socket server");
            resolve();
          });
          vscodeSocket.on("connect_error", (error) => {
            reject(
              new Error(
                `Failed to connect to VS Code extension: ${error.message}`
              )
            );
          });

          // Timeout after 10 seconds
          setTimeout(
            () => reject(new Error("Timeout connecting to VS Code extension")),
            10000
          );
        });

        endTiming("VS Code Socket Connection");

        // Check VS Code status
        startTiming("VS Code Status Check");
        const status = await new Promise((resolve) => {
          vscodeSocket.emit("vscode:get-status", (data) => {
            resolve(data);
          });
        });

        logProgress("VS Code extension status:");
        console.log("  Ready:", status.ready);
        console.log("  Workspace folders:", status.workspaceFolders);
        endTiming("VS Code Status Check");

        // Execute command through VS Code
        startTiming("VS Code Command Execution");
        logProgress(`Sending command to VS Code: ${customPrompt}`);

        const result = await new Promise((resolve) => {
          vscodeSocket.emit(
            "vscode:execute-command",
            {
              command: customPrompt,
              workingDirectory: "/root/workspace",
            },
            (response) => {
              resolve(response);
            }
          );
        });

        if (result.success) {
          logProgress("Command sent successfully to VS Code");
        } else {
          logProgress("Failed to send command:", result.error);
        }

        // Wait for terminal output
        vscodeSocket.on("vscode:terminal-created", (data) => {
          logProgress("VS Code terminal created:");
          console.log("  Terminal ID:", data.terminalId);
          console.log("  Name:", data.name);
          console.log("  Working directory:", data.cwd);
        });

        // Give time for command execution
        await delay(3000);

        endTiming("VS Code Command Execution");

        // Disconnect from VS Code socket
        vscodeSocket.disconnect();
        logProgress("Disconnected from VS Code extension");
      } catch (error) {
        logProgress("Error with VS Code socket:", error.message);
        endTiming("VS Code Socket Connection");
        endTiming("VS Code Status Check");
        endTiming("VS Code Command Execution");
      }
    } else {
      logProgress("No custom prompt provided, skipping VS Code terminal test");
    }
    endTiming("Worker Test");
    clearTestTimeout();
    logProgress("Test completed successfully!");

    // Disconnect sockets
    // await delay(1000);
    // managementSocket.disconnect();
    // clientSocket.disconnect();

    // Handle keep-alive mode
    if (keepAlive) {
      console.log("\n🔧 KEEP-ALIVE MODE");
      console.log("================");
      console.log("Container is still running. You can:");
      console.log("  - Connect to OpenVSCode (http://localhost:2376)");
      console.log(
        "  - Test worker on port 2377 (with /client and /management namespaces)"
      );
      if (workspacePath) {
        console.log(
          `  - Access mounted workspace at /root/workspace (from ${workspacePath})`
        );
      }
      console.log(
        "\nTo see OpenVSCode URL: docker logs " +
          CONTAINER_NAME +
          " | grep 'Web UI'"
      );
      console.log("\n🐚 Spawning interactive shell inside container...\n");

      // Spawn interactive shell
      const shell = spawn(
        "docker",
        ["exec", "-it", CONTAINER_NAME, "/bin/bash"],
        {
          stdio: "inherit",
        }
      );

      shell.on("exit", (code) => {
        console.log(`\n✅ Shell exited with code ${code}`);
        cleanup();
      });

      shell.on("error", (error) => {
        console.error("\n❌ Failed to spawn shell:", error);
        cleanup();
      });
    } else {
      cleanup();
    }
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    endTiming("Worker Registration");
    endTiming("Docker-in-Docker Check");
    endTiming("Socket Connection");
    endTiming("Worker Test");
    clearTestTimeout();
    cleanup();
  }
}

let dockerProcess;

// Cleanup function
function cleanup() {
  console.log("\n=== CLEANUP ===");
  startTiming("Cleanup");
  logProgress("Stopping Docker container...");
  try {
    execSync(`docker stop ${CONTAINER_NAME}`);
    logProgress("Container stopped");
  } catch (error) {
    logProgress("Container already stopped or not running");
  }
  endTiming("Cleanup");

  printTimingSummary();
  console.log("\n👋 Test complete!\n");
  process.exit(0);
}

// Graceful shutdown
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// Main execution
(async () => {
  console.log("\n🚀 CODEROUTER WORKER TEST");
  console.log("========================\n");

  if (keepAlive) {
    console.log("Running in KEEP-ALIVE mode");
    console.log("Container will stay running after tests complete\n");
  }

  if (workspacePath) {
    console.log(`Mounting workspace: ${workspacePath} -> /root/workspace\n`);
  }

  console.log("This test will:");
  console.log("1. Build the Docker image");
  console.log("2. Start a worker container");
  console.log("3. Connect via Socket.IO to worker");
  console.log("4. Verify worker registration");
  console.log("5. Check Docker-in-Docker readiness");
  console.log("6. Create a terminal via worker and execute command");
  if (customPrompt) {
    console.log("7. Connect to VS Code extension socket server");
    console.log("8. Execute command via VS Code: " + customPrompt);
  }

  if (keepAlive) {
    console.log(
      `${customPrompt ? "9" : "7"}. Keep container running for manual testing`
    );
  }

  console.log(
    "\nUsage: node test-worker.mjs [--keep-alive | -k] [--workspace <path>] [--prompt <command>]\n"
  );
  console.log("Options:");
  console.log("  --keep-alive, -k      Keep container running after tests");
  console.log(
    "  --workspace <path>    Mount local path to /root/workspace in container"
  );
  console.log(
    '  --prompt, -p <cmd>    Custom command to run in terminal (default: echo "Hello from worker!")'
  );
  console.log("");

  startTiming("Total Test");

  try {
    dockerProcess = await setupDockerContainer();
    await testWorker();
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    endTiming("Total Test");
    cleanup();
  }
})();
