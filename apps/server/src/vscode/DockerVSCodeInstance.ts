import Docker from "dockerode";
import {
  VSCodeInstance,
  type VSCodeInstanceConfig,
  type VSCodeInstanceInfo,
} from "./VSCodeInstance.js";

export class DockerVSCodeInstance extends VSCodeInstance {
  private containerName: string;
  private imageName: string;
  private docker: Docker;
  private container: Docker.Container | null = null;

  constructor(config: VSCodeInstanceConfig) {
    super(config);
    this.containerName = `coderouter-vscode-${this.instanceId}`;
    this.imageName = "coderouter-worker:0.0.1";
    // Always use explicit socket path for consistency
    this.docker = new Docker({ socketPath: "/var/run/docker.sock" });
  }

  async start(): Promise<VSCodeInstanceInfo> {
    console.log(`Starting Docker VSCode instance: ${this.containerName}`);
    console.log(`  Image: ${this.imageName}`);
    console.log(`  Workspace: ${this.config.workspacePath}`);
    console.log(`  Agent name: ${this.config.agentName}`);

    // Stop and remove any existing container with same name
    try {
      const existingContainer = this.docker.getContainer(this.containerName);
      const info = await existingContainer.inspect().catch(() => null);
      if (info) {
        console.log(`Removing existing container ${this.containerName}`);
        await existingContainer.stop().catch(() => {});
        await existingContainer.remove().catch(() => {});
      }
    } catch (_error) {
      // Container doesn't exist, which is fine
    }

    // Create container configuration
    const createOptions: Docker.ContainerCreateOptions = {
      name: this.containerName,
      Image: this.imageName,
      Env: ["NODE_ENV=production", "WORKER_PORT=2377"],
      HostConfig: {
        AutoRemove: true,
        Privileged: true,
        PortBindings: {
          "2376/tcp": [{ HostPort: "0" }], // VS Code port
          "2377/tcp": [{ HostPort: "0" }], // Worker port
          "2378/tcp": [{ HostPort: "0" }], // Extension socket port
        },
      },
      ExposedPorts: {
        "2376/tcp": {},
        "2377/tcp": {},
        "2378/tcp": {},
      },
    };

    // Add volume mount if workspace path is provided
    if (this.config.workspacePath) {
      createOptions.HostConfig!.Binds = [
        `${this.config.workspacePath}:/root/workspace`,
      ];
    }

    console.log(`Creating container...`);

    // Create and start the container
    this.container = await this.docker.createContainer(createOptions);
    console.log(`Container created: ${this.container.id}`);

    await this.container.start();
    console.log(`Container started`);

    // Get container info including port mappings
    const containerInfo = await this.container.inspect();
    const ports = containerInfo.NetworkSettings.Ports;

    const vscodePort = ports["2376/tcp"]?.[0]?.HostPort;
    const workerPort = ports["2377/tcp"]?.[0]?.HostPort;

    if (!vscodePort) {
      console.error(`Available ports:`, ports);
      throw new Error("Failed to get VS Code port mapping for port 2376");
    }

    if (!workerPort) {
      console.error(`Available ports:`, ports);
      throw new Error("Failed to get worker port mapping for port 2377");
    }

    // Wait for worker to be ready by polling
    console.log(`Waiting for worker to be ready on port ${workerPort}...`);
    const maxAttempts = 30; // 15 seconds max
    const delayMs = 500;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(
          `http://localhost:${workerPort}/socket.io/?EIO=4&transport=polling`
        );
        if (response.ok) {
          console.log(`Worker is ready!`);
          break;
        }
      } catch {
        // Connection refused, worker not ready yet
      }

      if (i < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        console.warn("Worker may not be fully ready, but continuing...");
      }
    }

    const baseUrl = `http://localhost:${vscodePort}`;
    const workspaceUrl = this.getWorkspaceUrl(baseUrl);
    const workerUrl = `http://localhost:${workerPort}`;

    console.log(`Docker VSCode instance started:`);
    console.log(`  VS Code URL: ${workspaceUrl}`);
    console.log(`  Worker URL: ${workerUrl}`);

    // Monitor container events
    this.setupContainerEventMonitoring();

    // Connect to the worker
    try {
      await this.connectToWorker(workerUrl);
      console.log(
        `Successfully connected to worker for container ${this.containerName}`
      );
    } catch (error) {
      console.error(
        `Failed to connect to worker for container ${this.containerName}:`,
        error
      );
      // Continue anyway - the instance is running even if we can't connect to the worker
    }

    return {
      url: baseUrl,
      workspaceUrl,
      instanceId: this.instanceId,
      provider: "docker",
    };
  }

  private setupContainerEventMonitoring() {
    if (!this.container) return;

    // Monitor container events
    this.container.wait((err: Error | null, data: { StatusCode: number }) => {
      if (err) {
        console.error(`Container wait error:`, err);
      } else {
        console.log(
          `Container ${this.containerName} exited with status:`,
          data
        );
        this.emit("exit", data.StatusCode);
      }
    });

    // Attach to container streams for logs (only if DEBUG is enabled)
    if (process.env.DEBUG) {
      this.container.attach(
        { stream: true, stdout: true, stderr: true },
        (err: Error | null, stream?: NodeJS.ReadWriteStream) => {
          if (err) {
            console.error(`Failed to attach to container streams:`, err);
            return;
          }

          // Demultiplex the stream
          this.container!.modem.demuxStream(
            stream!,
            process.stdout,
            process.stderr
          );
        }
      );
    }
  }

  async stop(): Promise<void> {
    console.log(`Stopping Docker VSCode instance: ${this.containerName}`);

    // Disconnect from worker first
    await this.disconnectFromWorker();

    if (this.container) {
      try {
        await this.container.stop();
        console.log(`Container ${this.containerName} stopped`);
      } catch (error) {
        if ((error as { statusCode?: number }).statusCode !== 304) {
          // 304 means container already stopped
          console.error(
            `Error stopping container ${this.containerName}:`,
            error
          );
        }
      }
    }
  }

  async getStatus(): Promise<{ running: boolean; info?: VSCodeInstanceInfo }> {
    try {
      if (!this.container) {
        // Try to find container by name
        const containers = await this.docker.listContainers({
          all: true,
          filters: { name: [this.containerName] },
        });

        if (containers.length > 0) {
          this.container = this.docker.getContainer(containers[0].Id);
        } else {
          return { running: false };
        }
      }

      const containerInfo = await this.container.inspect();
      const running = containerInfo.State.Running;

      if (running) {
        const ports = containerInfo.NetworkSettings.Ports;
        const vscodePort = ports["2376/tcp"]?.[0]?.HostPort;

        if (vscodePort) {
          const baseUrl = `http://localhost:${vscodePort}`;
          return {
            running: true,
            info: {
              url: baseUrl,
              workspaceUrl: this.getWorkspaceUrl(baseUrl),
              instanceId: this.instanceId,
              provider: "docker",
            },
          };
        }
      }

      return { running };
    } catch (_error) {
      return { running: false };
    }
  }

  async getLogs(tail = 100): Promise<string> {
    if (!this.container) {
      throw new Error("Container not initialized");
    }

    const stream = await this.container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: true,
    });

    // Convert the stream to string
    const logs = stream.toString("utf8");
    return logs;
  }
}
