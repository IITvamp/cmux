import { type Instance, MorphCloudClient } from "morphcloud";
import { workerExec } from "src/utils/workerExec.js";
import z from "zod";
import { dockerLogger } from "../utils/fileLogger.js";
import {
  VSCodeInstance,
  type VSCodeInstanceConfig,
  type VSCodeInstanceInfo,
} from "./VSCodeInstance.js";

export class MorphVSCodeInstance extends VSCodeInstance {
  private morphClient: MorphCloudClient;
  private instance: Instance | null = null; // Morph instance type
  private snapshotId = "snapshot_kco1jqb6"; // Default snapshot ID

  constructor(config: VSCodeInstanceConfig) {
    super(config);
    this.morphClient = new MorphCloudClient();
  }

  async start(): Promise<VSCodeInstanceInfo> {
    dockerLogger.info(
      `Starting Morph VSCode instance with ID: ${this.instanceId}`
    );

    // Start the Morph instance
    this.instance = await this.morphClient.instances.start({
      snapshotId: this.snapshotId,
      // 30 minutes
      ttlSeconds: 60 * 30,
      ttlAction: "pause",
      metadata: {
        app: "cmux-dev-local  ",
      },
    });

    dockerLogger.info(`Morph instance created: ${this.instance.id}`);

    // Get exposed services
    const exposedServices = this.instance.networking.httpServices;
    const vscodeService = exposedServices.find(
      (service) => service.port === 39378
    );
    const workerService = exposedServices.find(
      (service) => service.port === 39377
    );

    if (!vscodeService || !workerService) {
      throw new Error("VSCode or worker service not found in Morph instance");
    }

    const workspaceUrl = this.getWorkspaceUrl(vscodeService.url);
    dockerLogger.info(`Morph VSCode instance started:`);
    dockerLogger.info(`  VS Code URL: ${workspaceUrl}`);
    dockerLogger.info(`  Worker URL: ${workerService.url}`);

    // Connect to the worker
    try {
      console.log("[MorphVSCodeInstance] Connecting to worker");
      await this.connectToWorker(workerService.url);
      dockerLogger.info(
        `Successfully connected to worker for Morph instance ${this.instance.id}`
      );
    } catch (error) {
      dockerLogger.error(
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
    dockerLogger.info(`Stopping Morph VSCode instance: ${this.instanceId}`);

    // Disconnect from worker first
    await this.disconnectFromWorker();

    // Stop the Morph instance
    if (this.instance) {
      await this.instance.stop();
      dockerLogger.info(`Morph instance ${this.instance.id} stopped`);
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
        (service) => service.port === 39378
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

  async setupDevcontainer() {
    const instance = this.instance;
    if (!instance) {
      throw new Error("Morph instance not started");
    }

    // first, try to read /root/workspace/.devcontainer/devcontainer.json
    const devcontainerJson = await workerExec({
      workerSocket: this.getWorkerSocket(),
      command: "cat",
      args: ["/root/workspace/.devcontainer/devcontainer.json"],
      cwd: "/root",
      env: {},
    });
    if (devcontainerJson.error) {
      throw new Error("Failed to read devcontainer.json");
    }

    const parsedDevcontainerJson = JSON.parse(devcontainerJson.stdout);

    console.log(
      "[MorphVSCodeInstance] Devcontainer JSON:",
      parsedDevcontainerJson
    );

    const forwardPorts = z
      .array(z.number())
      .safeParse(parsedDevcontainerJson.forwardPorts);
    if (!forwardPorts.success) {
      return;
    }
    const forwardPortsArray = forwardPorts.data;
    const devcontainerNetwork = await Promise.all(
      forwardPortsArray.map(async (port: number) => {
        try {
          const result = await instance.exposeHttpService(`port-${port}`, port);
          console.log(
            `[MorphVSCodeInstance] Exposed port ${port} on ${instance.id}`
          );
          return {
            port: result.port,
            url: result.url,
          };
        } catch (_error) {
          console.error(`[MorphVSCodeInstance] Failed to expose port ${port}`);
        }
        return null;
      })
    );
    console.log("[MorphVSCodeInstance] Networking:", devcontainerNetwork);
    return devcontainerNetwork;
  }

  getName(): string {
    const instance = this.instance;
    if (!instance) {
      throw new Error("Morph instance not started");
    }
    return instance.id;
  }
}
