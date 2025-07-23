import { type Instance, MorphCloudClient } from "morphcloud";
import {
  VSCodeInstance,
  type VSCodeInstanceConfig,
  type VSCodeInstanceInfo,
} from "./VSCodeInstance.js";

export class MorphVSCodeInstance extends VSCodeInstance {
  private morphClient: MorphCloudClient;
  private instance: Instance | null = null; // Morph instance type
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
    const vscodeService = exposedServices.find(
      (service) => service.port === 2376
    );
    const workerService = exposedServices.find(
      (service) => service.port === 2377
    );

    if (!vscodeService || !workerService) {
      throw new Error("VSCode or worker service not found in Morph instance");
    }

    const workspaceUrl = this.getWorkspaceUrl(vscodeService.url);
    console.log(`Morph VSCode instance started:`);
    console.log(`  VS Code URL: ${workspaceUrl}`);
    console.log(`  Worker URL: ${workerService.url}`);

    // Connect to the worker
    try {
      await this.connectToWorker(workerService.url);
      console.log(
        `Successfully connected to worker for Morph instance ${this.instance.id}`
      );
    } catch (error) {
      console.error(
        `Failed to connect to worker for Morph instance ${this.instance.id}:`,
        error
      );
      // Continue anyway - the instance is running even if we can't connect to the worker
    }

    return {
      url: vscodeService.url,
      workspaceUrl,
      instanceId: this.instanceId,
      taskRunId: this.taskRunId,
      provider: "morph",
    };
  }

  async stop(): Promise<void> {
    console.log(`Stopping Morph VSCode instance: ${this.instanceId}`);

    // Disconnect from worker first
    await this.disconnectFromWorker();

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
      const vscodeService = exposedServices.find(
        (service) => service.port === 2376
      );

      if (vscodeService) {
        return {
          running: true,
          info: {
            url: vscodeService.url,
            workspaceUrl: this.getWorkspaceUrl(vscodeService.url),
            instanceId: this.instanceId,
            taskRunId: this.taskRunId,
            provider: "morph",
          },
        };
      }

      return { running: false };
    } catch (_error) {
      return { running: false };
    }
  }
}
