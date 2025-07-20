import { MorphCloudClient } from "morphcloud";
import { io, type Socket } from "socket.io-client";
import type { ServerToWorkerEvents, WorkerToServerEvents } from "@coderouter/shared";
import { VSCodeInstance, type VSCodeInstanceConfig, type VSCodeInstanceInfo } from "./VSCodeInstance.js";

export class MorphVSCodeInstance extends VSCodeInstance {
  private morphClient: MorphCloudClient;
  private instance: any; // Morph instance type
  private workerSocket: Socket<WorkerToServerEvents, ServerToWorkerEvents> | null = null;
  private snapshotId = "snapshot_gn1wmycs"; // Default snapshot ID

  constructor(config: VSCodeInstanceConfig) {
    super(config);
    this.morphClient = new MorphCloudClient();
  }

  async start(): Promise<VSCodeInstanceInfo> {
    console.log(`Starting Morph VSCode instance with ID: ${this.instanceId}`);

    // Start the Morph instance
    this.instance = await this.morphClient.instances.start({
      snapshotId: this.snapshotId,
    });

    console.log(`Morph instance created: ${this.instance.id}`);

    // Get exposed services
    const exposedServices = this.instance.networking.httpServices;
    const vscodeService = exposedServices.find((service: any) => service.port === 2376);
    const workerService = exposedServices.find((service: any) => service.port === 2377);

    if (!vscodeService || !workerService) {
      throw new Error("VSCode or worker service not found in Morph instance");
    }

    const workspaceUrl = this.getWorkspaceUrl(vscodeService.url);
    console.log(`Morph VSCode instance started at: ${workspaceUrl}`);

    // If initial command is provided, connect to worker and execute it
    if (this.config.initialCommand) {
      await this.executeInitialCommand(workerService.url);
    }

    return {
      url: vscodeService.url,
      workspaceUrl,
      instanceId: this.instanceId,
      provider: "morph",
    };
  }

  private async executeInitialCommand(workerUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Connecting to worker at ${workerUrl}/management to execute initial command`);

      this.workerSocket = io(`${workerUrl}/management`, {
        timeout: 10000,
        reconnectionAttempts: 3,
      }) as Socket<WorkerToServerEvents, ServerToWorkerEvents>;

      const timeout = setTimeout(() => {
        reject(new Error("Timeout connecting to worker"));
      }, 15000);

      this.workerSocket.on("connect", () => {
        console.log("Connected to Morph worker");
        clearTimeout(timeout);

        // Create a terminal with the initial command
        const terminalId = crypto.randomUUID();
        this.workerSocket!.emit("worker:create-terminal", {
          terminalId,
          cols: 80,
          rows: 24,
          cwd: this.config.workspacePath ? "/root/workspace" : undefined,
          command: "/bin/bash",
          args: ["-c", this.config.initialCommand!],
        });

        // Wait for terminal creation confirmation
        this.workerSocket!.once("worker:terminal-created", (data) => {
          if (data.terminalId === terminalId) {
            console.log(`Terminal created with initial command: ${this.config.initialCommand}`);
            resolve();
          }
        });

        this.workerSocket!.once("worker:error", (data) => {
          reject(new Error(`Failed to create terminal: ${data.error}`));
        });
      });

      this.workerSocket.on("connect_error", (error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to connect to worker: ${error.message}`));
      });
    });
  }

  async stop(): Promise<void> {
    console.log(`Stopping Morph VSCode instance: ${this.instanceId}`);
    
    // Disconnect worker socket if connected
    if (this.workerSocket) {
      this.workerSocket.disconnect();
      this.workerSocket = null;
    }

    // Stop the Morph instance
    if (this.instance) {
      await this.instance.stop();
      console.log(`Morph instance ${this.instance.id} stopped`);
    }
  }

  async getStatus(): Promise<{ running: boolean; info?: VSCodeInstanceInfo }> {
    if (!this.instance) {
      return { running: false };
    }

    try {
      // Check if instance is still running
      // Note: You might need to adjust this based on Morph's API
      const exposedServices = this.instance.networking.httpServices;
      const vscodeService = exposedServices.find((service: any) => service.port === 2376);

      if (vscodeService) {
        return {
          running: true,
          info: {
            url: vscodeService.url,
            workspaceUrl: this.getWorkspaceUrl(vscodeService.url),
            instanceId: this.instanceId,
            provider: "morph",
          },
        };
      }

      return { running: false };
    } catch (error) {
      return { running: false };
    }
  }
}