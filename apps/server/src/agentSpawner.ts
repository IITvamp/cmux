import { api } from "@coderouter/convex/api";
import type { Id } from "@coderouter/convex/dataModel";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@coderouter/shared";
import {
  AGENT_CONFIGS,
  type AgentConfig,
  type AuthFileConfig,
} from "@coderouter/shared/agentConfig";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import type { Server } from "socket.io";
import { type GlobalTerminal } from "./terminal.js";
import { convex } from "./utils/convexClient.js";
import { DockerVSCodeInstance } from "./vscode/DockerVSCodeInstance.js";
import { MorphVSCodeInstance } from "./vscode/MorphVSCodeInstance.js";
import { VSCodeInstance } from "./vscode/VSCodeInstance.js";
import { getWorktreePath, setupProjectWorkspace } from "./workspace.js";

async function prepareAuthFiles(authFiles?: AuthFileConfig[]): Promise<
  Array<{
    sourcePath: string;
    destinationPath: string;
    content: string;
    mode?: string;
  }>
> {
  if (!authFiles) return [];

  const preparedFiles: Array<{
    sourcePath: string;
    destinationPath: string;
    content: string;
    mode?: string;
  }> = [];

  const platform = os.platform();
  const homeDir = os.homedir();

  for (const authFile of authFiles) {
    // Skip if platform doesn't match
    if (authFile.platform && authFile.platform !== platform) {
      continue;
    }

    // Resolve $HOME in paths
    const sourcePath = authFile.source.replace("$HOME", homeDir);
    const destinationPath = authFile.destination.replace("$HOME", "$HOME"); // Keep $HOME for container

    try {
      // Read the file
      const content = await fs.readFile(sourcePath, "base64");

      // Get file permissions
      const stats = await fs.stat(sourcePath);
      const mode = (stats.mode & parseInt("777", 8)).toString(8);

      preparedFiles.push({
        sourcePath,
        destinationPath,
        content,
        mode,
      });
    } catch (error) {
      console.warn(`Failed to read auth file ${sourcePath}:`, error);
      // Continue with other files
    }
  }

  return preparedFiles;
}

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

    // Build environment variables including API keys
    const envVars: Record<string, string> = {
      ...agent.env,
      PROMPT: options.taskDescription,
    };

    // Add required API keys from Convex
    if (agent.requiredApiKeys) {
      for (const keyConfig of agent.requiredApiKeys) {
        if (apiKeys[keyConfig.envVar]) {
          envVars[keyConfig.envVar] = apiKeys[keyConfig.envVar];
        }
      }
    }

    // No longer need envExports since we're passing env as an object to the worker

    // Build the agent command with proper quoting
    const escapedPrompt = options.taskDescription.replace(/"/g, '\\"');

    // Replace $PROMPT placeholders in args with the actual prompt
    const processedArgs = agent.args.map((arg) =>
      arg === "$PROMPT" ? `\\"${escapedPrompt}\\"` : arg
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

    // Prepare auth files before sending terminal creation command
    const authFiles = await prepareAuthFiles(agent.authFiles);
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
    // if (!vscodeInstance.isWorkerConnected()) {
    //   console.log(`[AgentSpawner] Waiting for worker connection...`);
    //   await new Promise<void>((resolve) => {
    //     const timeout = setTimeout(() => {
    //       console.error(`[AgentSpawner] Timeout waiting for worker connection`);
    //       resolve();
    //     }, 30000); // 30 second timeout

    //     vscodeInstance.once("worker-connected", () => {
    //       clearTimeout(timeout);
    //       resolve();
    //     });
    //   });
    // }

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
    const terminalCreationCommand = {
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
      authFiles: authFiles.map((f) => ({
        destinationPath: f.destinationPath,
        content: f.content,
        mode: f.mode,
      })),
    };

    console.log(`[AgentSpawner] Sending terminal creation command:`);
    console.log(`  Terminal ID: ${tmuxSessionName}`);
    console.log(
      `  Command: tmux new-session -d -s ${tmuxSessionName} bash -c "${agentCommand}"`
    );
    console.log(`  Auth files: ${authFiles.length}`);
    console.log(`  Environment vars:`, Object.keys(envVars));

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

    // send just ping
    workerSocket.emit("worker:check-docker", (result) => {
      console.log("Docker ready", result);
    });

    // Send the terminal creation command
    await new Promise((resolve, reject) => {
      workerSocket
        .timeout(15000)
        .emit(
          "worker:create-terminal",
          terminalCreationCommand,
          (timeoutError, result) => {
            if (timeoutError) {
              console.error(
                "Timeout waiting for terminal creation",
                timeoutError
              );
              reject(timeoutError);
              return;
            }
            if (result.error) {
              reject(result.error);
              return;
            } else {
              console.log("Terminal created successfully", result);
              resolve(result.data);
            }
          }
        );
    });

    // Wait for terminal creation confirmation
    // const terminalCreated = await new Promise<boolean>((resolve) => {
    //   const timeout = setTimeout(() => {
    //     console.error(
    //       `[AgentSpawner] Timeout waiting for terminal creation confirmation`
    //     );
    //     resolve(false);
    //   }, 15000); // 15 second timeout

    //   const handleTerminalCreated = (data: { terminalId: string }) => {
    //     if (data.terminalId === tmuxSessionName) {
    //       clearTimeout(timeout);
    //       console.log(
    //         `[AgentSpawner] Terminal created successfully for ${agent.name}`
    //       );
    //       resolve(true);
    //     }
    //   };

    //   const handleError = (data: { error: string }) => {
    //     clearTimeout(timeout);
    //     console.error(`[AgentSpawner] Worker error:`, data);
    //     resolve(false);
    //   };

    //   workerSocket.once("worker:terminal-created", handleTerminalCreated);
    //   workerSocket.once("worker:error", handleError);
    // });

    // if (!terminalCreated) {
    //   return {
    //     agentName: agent.name,
    //     terminalId,
    //     taskRunId,
    //     worktreePath,
    //     vscodeUrl,
    //     success: false,
    //     error: "Failed to create terminal in worker",
    //   };
    // }

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
  globalTerminals: Map<string, GlobalTerminal>,
  vscodeInstances: Map<string, VSCodeInstance>,
  io: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
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
