import { execSync, spawn } from "child_process";
import { io } from "socket.io-client";
import { setTimeout as delay } from "timers/promises";

const CONTAINER_NAME = "coderouter-worker-test";
const IMAGE_NAME = "coderouter-worker";

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
    execSync(`docker build --platform=linux/amd64 -t ${IMAGE_NAME} .`, {
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
  console.log("  - Port 3002: Worker client port");
  console.log("  - Port 3003: Worker management port");
  console.log("  - Privileged mode: Enabled (for Docker-in-Docker)");

  const dockerRun = spawn(
    "docker",
    [
      "run",
      "--rm",
      "--name",
      CONTAINER_NAME,
      "--privileged",
      "-p",
      "3002:3002",
      "-p",
      "3003:3003",
      "-e",
      "NODE_ENV=production",
      "-e",
      "WORKER_PORT=3002",
      "-e",
      "MANAGEMENT_PORT=3003",
      IMAGE_NAME,
    ],
    {
      stdio: "inherit",
    }
  );

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
  await delay(10000);

  // Check if container is running
  try {
    const containerCheck = execSync(`docker ps | grep ${CONTAINER_NAME}`, {
      encoding: "utf8",
    });
    if (!containerCheck) {
      console.error("\n✗ Container failed to start");
      console.log("\nChecking container logs:");
      try {
        const logs = execSync(`docker logs ${CONTAINER_NAME} --tail 50`, {
          encoding: "utf8",
        });
        console.log(logs);
      } catch (e) {
        console.error("Could not get container logs");
      }
      endTiming("Container Readiness Check");
      endTiming("Container Start");
      endTiming("Docker Setup");
      process.exit(1);
    }
  } catch (e) {
    console.error("\n✗ Container not found");
    endTiming("Container Readiness Check");
    endTiming("Container Start");
    endTiming("Docker Setup");
    process.exit(1);
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
  logProgress("Connecting to worker management port (3003)...");
  const managementSocket = io("http://localhost:3003", {
    timeout: 10000,
    reconnectionAttempts: 3,
  });

  // Set up management socket event handlers before connecting
  let registrationData = null;
  const registrationPromise = new Promise((resolve) => {
    managementSocket.on("worker:register", (data) => {
      registrationData = data;
      resolve(data);
    });
  });

  // Also test client connection
  logProgress("Connecting to worker client port (3002)...");
  const clientSocket = io("http://localhost:3002", {
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

    // Test creating a terminal
    startTiming("Terminal Creation");
    logProgress("Creating test terminal...");
    console.log("  Terminal ID: test-terminal-1");
    console.log("  Size: 80x24");
    console.log("  Working directory: /");

    managementSocket.emit("worker:create-terminal", {
      terminalId: "test-terminal-1",
      cols: 80,
      rows: 24,
      cwd: "/",
    });

    // Wait for terminal creation
    const terminalCreated = await waitForEvent(
      managementSocket,
      "worker:terminal-created"
    );
    endTiming("Terminal Creation");
    logProgress("Terminal created successfully");
    console.log("  Terminal ID:", terminalCreated.terminalId);

    // Test sending input
    startTiming("Command Execution");
    const testCommand = 'echo "Hello from worker!"';
    logProgress(`Sending test command: ${testCommand}`);

    managementSocket.emit("worker:terminal-input", {
      terminalId: "test-terminal-1",
      data: testCommand + "\r",
    });

    // Set up output handler and wait for expected output
    let outputReceived = false;
    const outputPromise = new Promise((resolve) => {
      managementSocket.on("worker:terminal-output", (data) => {
        logProgress("Terminal output received:");
        console.log("  Raw data:", JSON.stringify(data.data));
        console.log("  Decoded:", data.data);

        // Check for expected output
        if (!outputReceived && data.data.includes("Hello from worker!")) {
          outputReceived = true;
          logProgress("TEST SUCCESSFUL! Worker responded correctly.");
          resolve();
        }
      });
    });

    // Wait for the expected output with timeout
    await Promise.race([
      outputPromise,
      delay(10000).then(() => {
        throw new Error("Timeout waiting for terminal output");
      }),
    ]);

    endTiming("Command Execution");
    endTiming("Worker Test");
    clearTestTimeout();
    logProgress("Test completed successfully!");

    // Clean up
    await delay(1000);
    managementSocket.disconnect();
    clientSocket.disconnect();
    cleanup();
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    endTiming("Command Execution");
    endTiming("Terminal Creation");
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
  console.log("This test will:");
  console.log("1. Build the Docker image");
  console.log("2. Start a worker container");
  console.log("3. Connect via Socket.IO");
  console.log("4. Create a terminal");
  console.log("5. Execute a test command");
  console.log("6. Verify the output\n");

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
