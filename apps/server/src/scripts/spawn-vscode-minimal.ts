#!/usr/bin/env tsx
import Docker from "dockerode";
import { io, type Socket } from "socket.io-client";
import type { WorkerToServerEvents, ServerToWorkerEvents } from "@coderouter/shared";

interface ContainerInfo {
  containerId: string;
  containerName: string;
  vscodePort: string;
  workerPort: string;
  vscodeUrl: string;
}

async function spawnVSCodeContainer(docker: Docker): Promise<ContainerInfo> {
  const containerName = `coderouter-vscode-minimal-${Date.now()}`;
  const imageName = "coderouter-worker:0.0.1";

  console.log(`Creating container ${containerName}...`);
  
  // Test Docker connection first
  try {
    const info = await docker.info();
    console.log(`Docker daemon connected: ${info.Name}`);
  } catch (error) {
    console.error("Failed to connect to Docker:", error);
    throw new Error("Docker connection failed. Make sure Docker is running.");
  }

  // Create container
  const container = await docker.createContainer({
    name: containerName,
    Image: imageName,
    Env: [
      "NODE_ENV=production",
      "WORKER_PORT=2377",
    ],
    HostConfig: {
      AutoRemove: true,
      Privileged: true,
      PortBindings: {
        "2376/tcp": [{ HostPort: "0" }],
        "2377/tcp": [{ HostPort: "0" }],
        "2378/tcp": [{ HostPort: "0" }],
      },
    },
    ExposedPorts: {
      "2376/tcp": {},
      "2377/tcp": {},
      "2378/tcp": {},
    },
  });

  // Start container
  await container.start();
  console.log(`Container started`);

  // Wait for container to be ready
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Get port mappings
  const info = await container.inspect();
  const ports = info.NetworkSettings.Ports;
  
  const vscodePort = ports["2376/tcp"]?.[0]?.HostPort;
  const workerPort = ports["2377/tcp"]?.[0]?.HostPort;

  if (!vscodePort || !workerPort) {
    throw new Error("Failed to get port mappings");
  }

  const vscodeUrl = `http://localhost:${vscodePort}/?folder=/root/workspace`;
  
  return {
    containerId: container.id,
    containerName,
    vscodePort,
    workerPort,
    vscodeUrl,
  };
}

async function createTerminalWithPrompt(
  workerPort: string,
  prompt: string
): Promise<void> {
  const workerUrl = `http://localhost:${workerPort}`;
  
  console.log(`Connecting to worker at ${workerUrl}...`);
  
  // Connect to worker
  const socket = io(`${workerUrl}/management`, {
    reconnection: false,
    timeout: 10000,
  }) as Socket<WorkerToServerEvents, ServerToWorkerEvents>;

  return new Promise((resolve, reject) => {
    socket.on("connect", () => {
      console.log("Connected to worker");
      
      // Create terminal
      const terminalId = "claude-terminal";
      const command = "bun";
      const args = [
        "x",
        "@anthropic-ai/claude-code",
        "--model",
        "claude-sonnet-4-20250514",
        "--dangerously-skip-permissions",
        prompt,
      ];

      console.log(`Creating terminal with command: ${command} ${args.join(" ")}`);
      
      socket.emit("worker:create-terminal", {
        terminalId,
        command,
        args,
        cols: 80,
        rows: 24,
        env: {},
      });

      // Wait for confirmation
      socket.on("worker:terminal-created", (data) => {
        if (data.terminalId === terminalId) {
          console.log("Terminal created successfully");
          socket.disconnect();
          resolve();
        }
      });

      socket.on("worker:error", (error) => {
        console.error("Worker error:", error);
        socket.disconnect();
        reject(new Error(error.error));
      });
    });

    socket.on("connect_error", (error) => {
      console.error("Failed to connect to worker:", error.message);
      reject(error);
    });
  });
}

async function main() {
  const prompt = process.argv[2];
  if (!prompt) {
    console.error("Usage: spawn-vscode-minimal.ts <prompt>");
    process.exit(1);
  }

  console.log(`Spawning VSCode with prompt: ${prompt}`);

  // Docker connection setup - Bun requires explicit socket path
  const docker = new Docker({ socketPath: '/var/run/docker.sock' });
  let containerInfo: ContainerInfo | null = null;

  try {
    // Spawn container
    containerInfo = await spawnVSCodeContainer(docker);
    
    console.log(`\nVSCode instance started:`);
    console.log(`  URL: ${containerInfo.vscodeUrl}`);
    console.log(`  Container: ${containerInfo.containerName}`);
    
    // Create terminal with prompt
    await createTerminalWithPrompt(containerInfo.workerPort, prompt);

    console.log(`\n✅ VSCode is running at: ${containerInfo.vscodeUrl}`);
    console.log("\nClaude Code is running in the terminal. Open the URL above to interact with it.");
    console.log("Press Ctrl+C to stop\n");

    // Keep the process running
    process.on("SIGINT", async () => {
      console.log("\nStopping container...");
      if (containerInfo) {
        const container = docker.getContainer(containerInfo.containerId);
        await container.stop().catch(() => {});
      }
      process.exit(0);
    });
    
    // Prevent the process from exiting
    await new Promise(() => {});

  } catch (error) {
    console.error("Error:", error);
    if (containerInfo) {
      const container = docker.getContainer(containerInfo.containerId);
      await container.stop().catch(() => {});
    }
    process.exit(1);
  }
}

main().catch(console.error);