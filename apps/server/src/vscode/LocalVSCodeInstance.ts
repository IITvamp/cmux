import { exec } from "node:child_process";
import { promisify } from "node:util";
import { dockerLogger } from "../utils/fileLogger";
import {
  VSCodeInstance,
  type VSCodeInstanceConfig,
  type VSCodeInstanceInfo,
} from "./VSCodeInstance";

const execAsync = promisify(exec);

export class LocalVSCodeInstance extends VSCodeInstance {
  private workspacePath: string;

  constructor(config: VSCodeInstanceConfig) {
    super(config);
    this.workspacePath = config.workspacePath!;
  }

  async start(): Promise<VSCodeInstanceInfo> {
    dockerLogger.info(
      `[LocalVSCodeInstance ${this.instanceId}] Launching VSCode with worktree ${this.workspacePath}`
    );

    try {
      // Launch VSCode on macOS with the worktree
      await execAsync(`code "${this.workspacePath}"`);
    } catch (error) {
      dockerLogger.warn(
        `[LocalVSCodeInstance ${this.instanceId}] Failed to launch VSCode: ${error}`
      );
      // Continue anyway, VSCode might still open
    }

    const workspaceUrl = `vscode://file${this.workspacePath}`;

    dockerLogger.info(`[LocalVSCodeInstance] VSCode launched with workspace: ${workspaceUrl}`);

    return {
      url: workspaceUrl,
      workspaceUrl,
      instanceId: this.instanceId,
      taskRunId: this.taskRunId,
      provider: "local",
    };
  }

  async stop(): Promise<void> {
    // For local mode, we don't manage VSCode lifecycle
    await this.baseStop();
  }

  async getStatus(): Promise<{ running: boolean; info?: VSCodeInstanceInfo }> {
    // For local mode, assume it's running if started
    return {
      running: true,
      info: {
        url: `vscode://file${this.workspacePath}`,
        workspaceUrl: `vscode://file${this.workspacePath}`,
        instanceId: this.instanceId,
        taskRunId: this.taskRunId,
        provider: "local",
      },
    };
  }

  getName(): string {
    return `local-${this.instanceId}`;
  }
}