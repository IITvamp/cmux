import { api } from "@coderouter/convex/api";

import type { Id } from "@coderouter/convex/dataModel";
import {
  AGENT_CONFIGS,
  type AgentConfig,
  type EnvironmentResult,
} from "@coderouter/shared/agentConfig";
import type { WorkerCreateTerminal } from "@coderouter/shared/worker-schemas";
import { convex } from "./utils/convexClient.js";
import { DockerVSCodeInstance } from "./vscode/DockerVSCodeInstance.js";
import { MorphVSCodeInstance } from "./vscode/MorphVSCodeInstance.js";
import { VSCodeInstance } from "./vscode/VSCodeInstance.js";
import { getWorktreePath, setupProjectWorkspace } from "./workspace.js";

// Removed zipRepository function - no longer needed since we clone via socket commands

export interface AgentSpawnResult {
  agentName: string;
  terminalId: string;
  taskRunId: string | Id<"taskRuns">;
  worktreePath: string;
  vscodeUrl?: string;
  success: boolean;
  error?: string;
}

export async function spawnAgent(
  agent: AgentConfig,
  taskId: string | Id<"tasks">,
  vscodeInstances: Map<string, VSCodeInstance>,
  options: {
    repoUrl: string;
    branch?: string;
    taskDescription: string;
    isCloudMode?: boolean;
  }
): Promise<AgentSpawnResult> {
  try {
    // Create a task run for this specific agent
    const taskRunId = await convex.mutation(api.taskRuns.create, {
      taskId: taskId as Id<"tasks">,
      prompt: `${options.taskDescription} (${agent.name})`,
    });

    // Fetch API keys from Convex first
    const apiKeys = await convex.query(api.apiKeys.getAllForAgents);

    // Build environment variables
    let envVars: Record<string, string> = {
      PROMPT: options.taskDescription,
    };

    let authFiles: EnvironmentResult["files"] = [];

    // Use environment property if available
    if (agent.environment) {
      const envResult = await agent.environment();
      envVars = {
        ...envVars,
        ...envResult.env,
      };
      authFiles = envResult.files;
    }

    // Add required API keys from Convex
    if (agent.requiredApiKeys) {
      for (const keyConfig of agent.requiredApiKeys) {
        if (apiKeys[keyConfig.envVar]) {
          envVars[keyConfig.envVar] = apiKeys[keyConfig.envVar];
        }
      }
    }

    // Build the agent command with proper quoting
    const escapedPrompt = options.taskDescription.replace(/"/g, '\\"');

    // Replace $PROMPT placeholders in args with the actual prompt
    const processedArgs = agent.args.map((arg) =>
      arg === "$PROMPT" ? `"${escapedPrompt}"` : arg
    );

    const agentCommand = `${agent.command} ${processedArgs.join(" ")}`;

    // Build the tmux session command that will be sent via socket.io
    const tmuxSessionName = `${agent.name}-${taskRunId.slice(-8)}`;

    console.log(`[AgentSpawner] Building command for agent ${agent.name}:`);
    console.log(`  Raw command: ${agent.command}`);
    console.log(`  Processed args: ${processedArgs.join(" ")}`);
    console.log(`  Agent command: ${agentCommand}`);
    console.log(`  Tmux session name: ${tmuxSessionName}`);
    console.log(
      `  Environment vars to pass:`,
      Object.keys(envVars).filter(
        (k) => k.startsWith("ANTHROPIC_") || k.startsWith("GEMINI_")
      )
    );

    let vscodeInstance: VSCodeInstance;
    let worktreePath: string;

    if (options.isCloudMode) {
      // For Morph, create the instance and we'll clone the repo via socket command
      vscodeInstance = new MorphVSCodeInstance({
        agentName: agent.name,
      });

      worktreePath = "/root/workspace";
    } else {
      // For Docker, set up worktree as before
      const worktreeInfo = await getWorktreePath({
        repoUrl: options.repoUrl,
        branch: options.branch,
      });

      // Append agent name to branch name to make it unique
      worktreeInfo.branchName = `${worktreeInfo.branchName}-${agent.name}`;
      worktreeInfo.worktreePath = `${worktreeInfo.worktreePath}-${agent.name}`;

      // Setup workspace
      const workspaceResult = await setupProjectWorkspace({
        repoUrl: options.repoUrl,
        branch: options.branch,
        worktreeInfo,
      });

      if (!workspaceResult.success || !workspaceResult.worktreePath) {
        return {
          agentName: agent.name,
          terminalId: "",
          taskRunId,
          worktreePath: "",
          success: false,
          error: workspaceResult.error || "Failed to setup workspace",
        };
      }

      worktreePath = workspaceResult.worktreePath;

      console.log(
        `[AgentSpawner] Creating DockerVSCodeInstance for ${agent.name}`
      );
      vscodeInstance = new DockerVSCodeInstance({
        // workspacePath: worktreePath,
        agentName: agent.name,
      });
    }

    // Update the task run with the worktree path
    await convex.mutation(api.taskRuns.updateWorktreePath, {
      id: taskRunId,
      worktreePath: worktreePath,
    });

    // Store the VSCode instance
    vscodeInstances.set(vscodeInstance.getInstanceId(), vscodeInstance);

    console.log(`Starting VSCode instance for agent ${agent.name}...`);

    // Start the VSCode instance
    const vscodeInfo = await vscodeInstance.start();
    const vscodeUrl = vscodeInfo.workspaceUrl;

    console.log(
      `VSCode instance spawned for agent ${agent.name}: ${vscodeUrl}`
    );

    // Use taskRunId as terminal ID for compatibility
    const terminalId = taskRunId;

    // Log auth files if any
    if (authFiles.length > 0) {
      console.log(
        `[AgentSpawner] Prepared ${authFiles.length} auth files for agent ${agent.name}`
      );
    }

    // After VSCode instance is started, create the terminal with tmux session
    console.log(
      `[AgentSpawner] Preparing to send terminal creation command for ${agent.name}`
    );

    // Wait for worker connection if not already connected
    if (!vscodeInstance.isWorkerConnected()) {
      console.log(`[AgentSpawner] Waiting for worker connection...`);
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          console.error(`[AgentSpawner] Timeout waiting for worker connection`);
          resolve();
        }, 30000); // 30 second timeout

        vscodeInstance.once("worker-connected", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }

    // Get the worker socket
    const workerSocket = vscodeInstance.getWorkerSocket();
    if (!workerSocket) {
      console.error(
        `[AgentSpawner] No worker socket available for ${agent.name}`
      );
      return {
        agentName: agent.name,
        terminalId,
        taskRunId,
        worktreePath,
        vscodeUrl,
        success: false,
        error: "No worker connection available",
      };
    }
    if (!vscodeInstance.isWorkerConnected()) {
      throw new Error("Worker socket not available");
    }

    // Prepare the terminal creation command with auth files
    const terminalCreationCommand: WorkerCreateTerminal = {
      terminalId: tmuxSessionName,
      command: "tmux",
      args: [
        "new-session",
        "-d",
        "-s",
        tmuxSessionName,
        "bash",
        "-c",
        agentCommand,
      ],
      cols: 80,
      rows: 24,
      env: envVars,
      taskId: taskRunId,
      authFiles,
      cwd: "/root/workspace",
    };

    console.log(
      `[AgentSpawner] Sending terminal creation command at ${new Date().toISOString()}:`
    );
    console.log(`  Terminal ID: ${tmuxSessionName}`);
    console.log(
      `  Full terminal command object:`,
      JSON.stringify(
        terminalCreationCommand,
        (_key, value) => {
          if (typeof value === "string" && value.length > 1000) {
            return value.slice(0, 1000) + "...";
          }
          return value;
        },
        2
      )
    );
    console.log(`  isCloudMode:`, options.isCloudMode);

    // For Morph instances, we need to clone the repository first
    if (options.isCloudMode) {
      console.log(`[AgentSpawner] Cloning repository for Morph instance...`);

      // Create a terminal to clone the repository
      const cloneTerminalId = `clone-${taskRunId.slice(-8)}`;
      const cloneCommand = {
        terminalId: cloneTerminalId,
        command: "bash",
        args: [
          "-c",
          `git clone ${options.repoUrl} /root/workspace && cd /root/workspace${options.branch && options.branch !== "main" ? ` && git checkout ${options.branch}` : ""}`,
        ],
        cols: 80,
        rows: 24,
        env: {},
        taskId: taskRunId,
      };

      await new Promise((resolve, reject) => {
        workerSocket
          .timeout(15000)
          .emit(
            "worker:create-terminal",
            cloneCommand,
            (timeoutError, result) => {
              if (timeoutError) {
                console.error(
                  "Timeout waiting for clone terminal creation",
                  timeoutError
                );
                reject(timeoutError);
              }
              if (result.error) {
                reject(result.error);
              } else {
                console.log("Clone terminal created successfully", result);
                resolve(result.data);
              }
            }
          );
      });

      // Wait for clone to complete
      const cloneCompleted = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          console.error(`[AgentSpawner] Timeout waiting for repository clone`);
          resolve(false);
        }, 60000); // 60 second timeout for cloning

        const handleTerminalExit = (data: {
          terminalId: string;
          exitCode: number;
        }) => {
          if (data.terminalId === cloneTerminalId && data.exitCode === 0) {
            clearTimeout(timeout);
            console.log(`[AgentSpawner] Repository cloned successfully`);
            resolve(true);
          } else if (data.terminalId === cloneTerminalId) {
            clearTimeout(timeout);
            console.error(
              `[AgentSpawner] Repository clone failed with exit code ${data.exitCode}`
            );
            resolve(false);
          }
        };

        workerSocket.once("worker:terminal-exit", handleTerminalExit);
      });

      if (!cloneCompleted) {
        return {
          agentName: agent.name,
          terminalId,
          taskRunId,
          worktreePath,
          vscodeUrl,
          success: false,
          error: "Failed to clone repository",
        };
      }

      // Close the clone terminal
      workerSocket.emit("worker:close-terminal", {
        terminalId: cloneTerminalId,
      });
    }

    // Send the terminal creation command
    console.log(
      `[AgentSpawner] About to emit worker:create-terminal at ${new Date().toISOString()}`
    );
    console.log(`[AgentSpawner] Socket connected:`, workerSocket.connected);
    console.log(`[AgentSpawner] Socket id:`, workerSocket.id);

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error(
          `[AgentSpawner] Timeout waiting for terminal creation response after 30s`
        );
        reject(new Error("Timeout waiting for terminal creation"));
      }, 30000);

      workerSocket.emit(
        "worker:create-terminal",
        terminalCreationCommand,
        (result) => {
          clearTimeout(timeout);
          console.log(
            `[AgentSpawner] Got response from worker:create-terminal at ${new Date().toISOString()}:`,
            result
          );
          if (result.error) {
            reject(result.error);
            return;
          } else {
            console.log("Terminal created successfully", result);
            resolve(result.data);
          }
        }
      );
      console.log(
        `[AgentSpawner] Emitted worker:create-terminal at ${new Date().toISOString()}`
      );
    });

    // Clean up instance on exit
    vscodeInstance.on("exit", () => {
      vscodeInstances.delete(vscodeInstance.getInstanceId());
      console.log(
        `VSCode instance ${vscodeInstance.getInstanceId()} for agent ${agent.name} exited`
      );
    });

    return {
      agentName: agent.name,
      terminalId,
      taskRunId,
      worktreePath,
      vscodeUrl,
      success: true,
    };
  } catch (error) {
    return {
      agentName: agent.name,
      terminalId: "",
      taskRunId: "",
      worktreePath: "",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function spawnAllAgents(
  taskId: string | Id<"tasks">,
  vscodeInstances: Map<string, VSCodeInstance>,
  options: {
    repoUrl: string;
    branch?: string;
    taskDescription: string;
    selectedAgents?: string[];
    isCloudMode?: boolean;
  }
): Promise<AgentSpawnResult[]> {
  // Spawn agents sequentially to avoid git lock conflicts
  const results: AgentSpawnResult[] = [];

  // If selectedAgents is provided, filter AGENT_CONFIGS to only include selected agents
  const agentsToSpawn = options.selectedAgents
    ? AGENT_CONFIGS.filter((agent) =>
        options.selectedAgents!.includes(agent.name)
      )
    : AGENT_CONFIGS;

  for (const agent of agentsToSpawn) {
    const result = await spawnAgent(agent, taskId, vscodeInstances, options);
    results.push(result);
  }

  return results;
}
