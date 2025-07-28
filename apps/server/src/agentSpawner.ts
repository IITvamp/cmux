import { api } from "@cmux/convex/api";

import type { Id } from "@cmux/convex/dataModel";
import {
  AGENT_CONFIGS,
  type AgentConfig,
  type EnvironmentResult,
} from "@cmux/shared/agentConfig";
import type { WorkerCreateTerminal } from "@cmux/shared/worker-schemas";
import { convex } from "./utils/convexClient.js";
import { DockerVSCodeInstance } from "./vscode/DockerVSCodeInstance.js";
import { MorphVSCodeInstance } from "./vscode/MorphVSCodeInstance.js";
import { VSCodeInstance } from "./vscode/VSCodeInstance.js";
import { getWorktreePath, setupProjectWorkspace } from "./workspace.js";

/**
 * Sanitize a string to be used as a tmux session name.
 * Tmux session names cannot contain: periods (.), colons (:), spaces, or other special characters.
 * We'll replace them with underscores to ensure compatibility.
 */
function sanitizeTmuxSessionName(name: string): string {
  // Replace all invalid characters with underscores
  // Allow only alphanumeric characters, hyphens, and underscores
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Automatically commit and push changes when a task completes
 */
async function performAutoCommitAndPush(
  vscodeInstance: VSCodeInstance,
  agent: AgentConfig,
  taskRunId: string | Id<"taskRuns">,
  taskDescription: string
): Promise<void> {
  try {
    console.log(`[AgentSpawner] Starting auto-commit and push for ${agent.name}`);
    
    // Create a unique branch name for this task run
    // Include a sanitized version of the task description for better clarity
    const sanitizedTaskDesc = taskDescription
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
      .trim()
      .split(/\s+/) // Split by whitespace
      .slice(0, 5) // Take first 5 words max
      .join('-')
      .substring(0, 30); // Limit length
    
    const branchName = `cmux-${agent.name}-${sanitizedTaskDesc}-${taskRunId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-');
    
    // Use task description as the main commit message
    // Truncate if too long (git has limits on commit message length)
    const truncatedDescription = taskDescription.length > 72 
      ? taskDescription.substring(0, 69) + "..." 
      : taskDescription;
    
    const commitMessage = `${truncatedDescription}

Task completed by ${agent.name} agent

🤖 Generated with cmux
Agent: ${agent.name}
Task Run ID: ${taskRunId}
Branch: ${branchName}
Completed: ${new Date().toISOString()}`;

    // Try to use VSCode extension API first (more reliable)
    const extensionResult = await tryVSCodeExtensionCommit(vscodeInstance, branchName, commitMessage, agent.name);
    
    if (extensionResult.success) {
      console.log(`[AgentSpawner] Successfully committed via VSCode extension`);
      console.log(`[AgentSpawner] Branch: ${branchName}`);
      console.log(`[AgentSpawner] Commit message: ${commitMessage.split('\n')[0]}`);
      return;
    }

    console.log(`[AgentSpawner] VSCode extension method failed, falling back to git commands:`, extensionResult.error);
    
    // Fallback to direct git commands
    const workerSocket = vscodeInstance.getWorkerSocket();
    if (!workerSocket || !vscodeInstance.isWorkerConnected()) {
      console.log(`[AgentSpawner] No worker connection for auto-commit fallback`);
      return;
    }
        
    // Execute git commands in sequence
    const gitCommands = [
      // Add all changes
      `git add .`,
      // Create and switch to new branch
      `git checkout -b ${branchName}`,
      // Commit with a descriptive message (escape quotes properly)
      `git commit -m "${commitMessage.replace(/"/g, '\\"')}"`,
      // Push branch to origin
      `git push -u origin ${branchName}`
    ];

    for (const command of gitCommands) {
      console.log(`[AgentSpawner] Executing: ${command}`);
      
      const result = await new Promise<{
        success: boolean;
        stdout?: string;
        stderr?: string;
        exitCode?: number;
        error?: string;
      }>((resolve) => {
        workerSocket
          .timeout(30000) // 30 second timeout
          .emit(
            "worker:exec",
            {
              command: "bash",
              args: ["-c", command],
              cwd: "/root/workspace",
              env: {},
            },
            (timeoutError, result) => {
              if (timeoutError) {
                console.error(`[AgentSpawner] Timeout executing: ${command}`, timeoutError);
                resolve({
                  success: false,
                  error: "Timeout waiting for git command",
                });
                return;
              }
              if (result.error) {
                resolve({ success: false, error: result.error.message });
                return;
              }

              const { stdout, stderr, exitCode } = result.data!;
              console.log(`[AgentSpawner] Command output:`, { stdout, stderr, exitCode });

              if (exitCode === 0) {
                resolve({ success: true, stdout, stderr, exitCode });
              } else {
                resolve({
                  success: false,
                  stdout,
                  stderr,
                  exitCode,
                  error: `Command failed with exit code ${exitCode}`,
                });
              }
            }
          );
      });

      if (!result.success) {
        console.error(`[AgentSpawner] Git command failed: ${command}`, result.error);
        // Don't stop on individual command failures - some might be expected (e.g., no changes to commit)
        continue;
      }
    }

    console.log(`[AgentSpawner] Auto-commit and push completed for ${agent.name} on branch ${branchName}`);
  } catch (error) {
    console.error(`[AgentSpawner] Error in auto-commit and push:`, error);
  }
}

/**
 * Try to use VSCode extension API for git operations
 */
async function tryVSCodeExtensionCommit(
  vscodeInstance: VSCodeInstance,
  branchName: string,
  commitMessage: string,
  agentName: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    // For Docker instances, get the extension port
    let extensionPort: string | undefined;
    if (vscodeInstance instanceof DockerVSCodeInstance) {
      const ports = (vscodeInstance as DockerVSCodeInstance).getPorts();
      extensionPort = ports?.extension;
    }

    if (!extensionPort) {
      return { success: false, error: "Extension port not available" };
    }

    // Connect to VSCode extension socket
    const { io } = await import("socket.io-client");
    const extensionSocket = io(`http://localhost:${extensionPort}`, {
      timeout: 10000,
    });

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        extensionSocket.disconnect();
        resolve({ success: false, error: "Timeout connecting to VSCode extension" });
      }, 15000);

      extensionSocket.on("connect", () => {
        console.log(`[AgentSpawner] Connected to VSCode extension on port ${extensionPort}`);
        
        extensionSocket.emit("vscode:auto-commit-push", {
          branchName,
          commitMessage,
          agentName
        }, (response: any) => {
          clearTimeout(timeout);
          extensionSocket.disconnect();
          
          if (response.success) {
            resolve({ success: true, message: response.message });
          } else {
            resolve({ success: false, error: response.error });
          }
        });
      });

      extensionSocket.on("connect_error", (error) => {
        clearTimeout(timeout);
        extensionSocket.disconnect();
        resolve({ success: false, error: `Connection error: ${error.message}` });
      });
    });
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

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
  options: {
    repoUrl: string;
    branch?: string;
    taskDescription: string;
    isCloudMode?: boolean;
    images?: Array<{
      src: string;
      fileName?: string;
      altText: string;
    }>;
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

    // Fetch the task to get image storage IDs
    const task = await convex.query(api.tasks.getById, {
      id: taskId as Id<"tasks">,
    });

    // Process prompt to handle images
    let processedTaskDescription = options.taskDescription;
    const imageFiles: Array<{ path: string; base64: string }> = [];

    // Handle images from either the options (for backward compatibility) or from the task
    let imagesToProcess = options.images || [];

    // If task has images with storage IDs, download them
    if (task && task.images && task.images.length > 0) {
      const downloadedImages = await Promise.all(
        task.images.map(async (image: any) => {
          if (image.url) {
            // Download image from Convex storage
            const response = await fetch(image.url);
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString("base64");
            return {
              src: `data:image/png;base64,${base64}`,
              fileName: image.fileName,
              altText: image.altText,
            };
          }
          return null;
        })
      );
      const filteredImages = downloadedImages.filter((img) => img !== null);
      imagesToProcess = filteredImages as Array<{
        src: string;
        fileName?: string;
        altText: string;
      }>;
    }

    if (imagesToProcess.length > 0) {
      console.log(`[AgentSpawner] Processing ${imagesToProcess.length} images`);
      console.log(`[AgentSpawner] Original task description: ${options.taskDescription}`);
      
      // Create image files and update prompt
      imagesToProcess.forEach((image, index) => {
        // Sanitize filename to remove special characters
        let fileName = image.fileName || `image_${index + 1}.png`;
        console.log(`[AgentSpawner] Original filename: ${fileName}`);
        
        // Replace non-ASCII characters and spaces with underscores
        fileName = fileName.replace(/[^\x00-\x7F]/g, '_').replace(/\s+/g, '_');
        console.log(`[AgentSpawner] Sanitized filename: ${fileName}`);
        
        const imagePath = `/root/prompt/${fileName}`;
        imageFiles.push({
          path: imagePath,
          base64: image.src.split(",")[1] || image.src, // Remove data URL prefix if present
        });

        // Replace image reference in prompt with file path
        // First try to replace the original filename
        if (image.fileName) {
          const beforeReplace = processedTaskDescription;
          processedTaskDescription = processedTaskDescription.replace(
            new RegExp(`\\b${image.fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "g"),
            imagePath
          );
          if (beforeReplace !== processedTaskDescription) {
            console.log(`[AgentSpawner] Replaced "${image.fileName}" with "${imagePath}"`);
          }
        }
        
        // Also replace just the filename without extension in case it appears that way
        const nameWithoutExt = image.fileName?.replace(/\.[^/.]+$/, "");
        if (nameWithoutExt) {
          const beforeReplace = processedTaskDescription;
          processedTaskDescription = processedTaskDescription.replace(
            new RegExp(`\\b${nameWithoutExt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "g"),
            imagePath
          );
          if (beforeReplace !== processedTaskDescription) {
            console.log(`[AgentSpawner] Replaced "${nameWithoutExt}" with "${imagePath}"`);
          }
        }
      });
      
      console.log(`[AgentSpawner] Processed task description: ${processedTaskDescription}`);
    }

    // Build environment variables
    let envVars: Record<string, string> = {
      PROMPT: processedTaskDescription,
    };

    let authFiles: EnvironmentResult["files"] = [];
    let startupCommands: string[] = [];

    // Use environment property if available
    if (agent.environment) {
      const envResult = await agent.environment();
      envVars = {
        ...envVars,
        ...envResult.env,
      };
      authFiles = envResult.files;
      startupCommands = envResult.startupCommands || [];
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
    const escapedPrompt = processedTaskDescription.replace(/"/g, '\\"');

    // Replace $PROMPT placeholders in args with the actual prompt
    const processedArgs = agent.args.map((arg) =>
      arg === "$PROMPT" ? `"${escapedPrompt}"` : arg
    );

    const agentCommand = `${agent.command} ${processedArgs.join(" ")}`;

    // Build the tmux session command that will be sent via socket.io
    const tmuxSessionName = sanitizeTmuxSessionName(`${agent.name}-${taskRunId.slice(-8)}`);

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
        taskRunId: taskRunId as string,
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
        workspacePath: worktreePath,
        agentName: agent.name,
        taskRunId: taskRunId as string,
      });
    }

    // Update the task run with the worktree path
    await convex.mutation(api.taskRuns.updateWorktreePath, {
      id: taskRunId,
      worktreePath: worktreePath,
    });

    // Store the VSCode instance
    // VSCodeInstance.getInstances().set(vscodeInstance.getInstanceId(), vscodeInstance);

    console.log(`Starting VSCode instance for agent ${agent.name}...`);

    // Start the VSCode instance
    const vscodeInfo = await vscodeInstance.start();
    const vscodeUrl = vscodeInfo.workspaceUrl;

    console.log(
      `VSCode instance spawned for agent ${agent.name}: ${vscodeUrl}`
    );

    // Set up terminal-idle event handler
    vscodeInstance.on("terminal-idle", async (data) => {
      console.log(
        `[AgentSpawner] Terminal idle detected for ${agent.name}:`,
        data
      );

      // Update the task run as completed
      if (data.taskId === taskRunId) {
        try {
          await convex.mutation(api.taskRuns.complete, {
            id: taskRunId as Id<"taskRuns">,
            exitCode: 0,
          });

          console.log(
            `[AgentSpawner] Updated taskRun ${taskRunId} as completed after ${data.elapsedMs}ms`
          );

          // Wait a bit to ensure all file changes are saved
          console.log(`[AgentSpawner] Waiting 2 seconds before auto-commit to ensure all changes are saved...`);
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Auto-commit and push changes in VSCode editor
          await performAutoCommitAndPush(vscodeInstance, agent, taskRunId, options.taskDescription);

          // Schedule container stop based on settings
          const containerSettings = await convex.query(
            api.containerSettings.getEffective
          );
          
          if (containerSettings.autoCleanupEnabled) {
            if (containerSettings.stopImmediatelyOnCompletion) {
              // Stop container immediately
              console.log(
                `[AgentSpawner] Stopping container immediately as per settings`
              );
              
              // Stop the VSCode instance
              await vscodeInstance.stop();
            } else {
              // Schedule stop after review period
              const reviewPeriodMs = containerSettings.reviewPeriodMinutes * 60 * 1000;
              const scheduledStopAt = Date.now() + reviewPeriodMs;
              
              await convex.mutation(api.taskRuns.updateScheduledStop, {
                id: taskRunId as Id<"taskRuns">,
                scheduledStopAt,
              });
              
              console.log(
                `[AgentSpawner] Scheduled container stop for ${new Date(scheduledStopAt).toISOString()}`
              );
            }
          }

          // Check if all task runs for this task are completed
          const taskRuns = await convex.query(api.taskRuns.getByTask, {
            taskId: taskId as Id<"tasks">,
          });

          const allCompleted = taskRuns.every(
            (run) => run.status === "completed" || run.status === "failed"
          );

          if (allCompleted) {
            // Update the main task as completed
            await convex.mutation(api.tasks.setCompleted, {
              id: taskId as Id<"tasks">,
              isCompleted: true,
            });

            console.log(
              `[AgentSpawner] All task runs completed, updated task ${taskId} as completed`
            );
          }
        } catch (error) {
          console.error(
            `[AgentSpawner] Error updating task run after idle:`,
            error
          );
        }
      }
    });

    // Get ports if it's a Docker instance
    let ports:
      | { vscode: string; worker: string; extension?: string }
      | undefined;
    if (vscodeInstance instanceof DockerVSCodeInstance) {
      const dockerPorts = vscodeInstance.getPorts();
      if (dockerPorts && dockerPorts.vscode && dockerPorts.worker) {
        ports = {
          vscode: dockerPorts.vscode,
          worker: dockerPorts.worker,
          ...(dockerPorts.extension
            ? { extension: dockerPorts.extension }
            : {}),
        };
      }
    }

    // Update VSCode instance information in Convex
    await convex.mutation(api.taskRuns.updateVSCodeInstance, {
      id: taskRunId,
      vscode: {
        provider: vscodeInfo.provider,
        containerName:
          vscodeInstance instanceof DockerVSCodeInstance
            ? (vscodeInstance as DockerVSCodeInstance).getContainerName()
            : undefined,
        status: "running",
        url: vscodeInfo.url,
        workspaceUrl: vscodeInfo.workspaceUrl,
        startedAt: Date.now(),
        ...(ports ? { ports } : {}),
      },
    });

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
      startupCommands,
      cwd: "/root/workspace",
    };

    console.log(
      `[AgentSpawner] Sending terminal creation command at ${new Date().toISOString()}:`
    );
    console.log(`  Terminal ID: ${tmuxSessionName}`);
    // console.log(
    //   `  Full terminal command object:`,
    //   JSON.stringify(
    //     terminalCreationCommand,
    //     (_key, value) => {
    //       if (typeof value === "string" && value.length > 1000) {
    //         return value.slice(0, 1000) + "...";
    //       }
    //       return value;
    //     },
    //     2
    //   )
    // );
    console.log(`  isCloudMode:`, options.isCloudMode);

    // For Morph instances, we need to clone the repository first
    if (options.isCloudMode) {
      console.log(`[AgentSpawner] Cloning repository for Morph instance...`);

      // Use worker:exec to clone the repository
      const cloneCommand = `git clone ${options.repoUrl} /root/workspace${
        options.branch && options.branch !== "main"
          ? ` && cd /root/workspace && git checkout ${options.branch}`
          : ""
      }`;

      const cloneResult = await new Promise<{
        success: boolean;
        error?: string;
      }>((resolve) => {
        workerSocket
          .timeout(60000) // 60 second timeout for cloning
          .emit(
            "worker:exec",
            {
              command: "bash",
              args: ["-c", cloneCommand],
              cwd: "/root",
              env: {},
            },
            (timeoutError, result) => {
              if (timeoutError) {
                console.error("Timeout waiting for git clone", timeoutError);
                resolve({
                  success: false,
                  error: "Timeout waiting for git clone",
                });
                return;
              }
              if (result.error) {
                resolve({ success: false, error: result.error.message });
                return;
              }

              const { stdout, stderr, exitCode } = result.data!;
              console.log(`[AgentSpawner] Git clone stdout:`, stdout);
              if (stderr) {
                console.log(`[AgentSpawner] Git clone stderr:`, stderr);
              }

              if (exitCode === 0) {
                console.log(`[AgentSpawner] Repository cloned successfully`);
                resolve({ success: true });
              } else {
                console.error(
                  `[AgentSpawner] Git clone failed with exit code ${exitCode}`
                );
                resolve({
                  success: false,
                  error: `Git clone failed with exit code ${exitCode}`,
                });
              }
            }
          );
      });

      if (!cloneResult.success) {
        return {
          agentName: agent.name,
          terminalId,
          taskRunId,
          worktreePath,
          vscodeUrl,
          success: false,
          error: cloneResult.error || "Failed to clone repository",
        };
      }
    }

    // Create image files if any
    if (imageFiles.length > 0) {
      console.log(
        `[AgentSpawner] Creating ${imageFiles.length} image files...`
      );

      // First create the prompt directory
      await new Promise<void>((resolve) => {
        workerSocket.timeout(10000).emit(
          "worker:exec",
          {
            command: "mkdir",
            args: ["-p", "/root/prompt"],
            cwd: "/root",
            env: {},
          },
          (timeoutError, result) => {
            if (timeoutError || result.error) {
              console.error(
                "Failed to create prompt directory",
                timeoutError || result.error
              );
            }
            resolve();
          }
        );
      });

      // Upload each image file using HTTP endpoint
      for (const imageFile of imageFiles) {
        try {
          // Convert base64 to buffer
          const base64Data = imageFile.base64.includes(',') 
            ? imageFile.base64.split(',')[1] 
            : imageFile.base64;
          const buffer = Buffer.from(base64Data, 'base64');

          // Create form data
          const formData = new FormData();
          const blob = new Blob([buffer], { type: 'image/png' });
          formData.append('image', blob, 'image.png');
          formData.append('path', imageFile.path);

          // Get worker port from VSCode instance
          const workerPort = vscodeInstance instanceof DockerVSCodeInstance 
            ? (vscodeInstance as DockerVSCodeInstance).getPorts()?.worker
            : "39377";

          const uploadUrl = `http://localhost:${workerPort}/upload-image`;
          
          console.log(`[AgentSpawner] Uploading image to ${uploadUrl}`);

          const response = await fetch(uploadUrl, {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`Upload failed: ${error}`);
          }

          const result = await response.json();
          console.log(`[AgentSpawner] Successfully uploaded image: ${result.path} (${result.size} bytes)`);
        } catch (error) {
          console.error(`[AgentSpawner] Failed to upload image ${imageFile.path}:`, error);
        }
      }
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

    return {
      agentName: agent.name,
      terminalId,
      taskRunId,
      worktreePath,
      vscodeUrl,
      success: true,
    };
  } catch (error) {
    console.error("Error spawning agent", error);
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
  options: {
    repoUrl: string;
    branch?: string;
    taskDescription: string;
    selectedAgents?: string[];
    isCloudMode?: boolean;
    images?: Array<{
      src: string;
      fileName?: string;
      altText: string;
    }>;
  }
): Promise<AgentSpawnResult[]> {
  // Spawn agents sequentially to avoid git lock conflicts

  // If selectedAgents is provided, filter AGENT_CONFIGS to only include selected agents
  const agentsToSpawn = options.selectedAgents
    ? AGENT_CONFIGS.filter((agent) =>
        options.selectedAgents!.includes(agent.name)
      )
    : AGENT_CONFIGS;

  // const results: AgentSpawnResult[] = [];
  // for (const agent of agentsToSpawn) {
  //   const result = await spawnAgent(agent, taskId, options);
  //   results.push(result);
  // }
  const results = await Promise.all(
    agentsToSpawn.map((agent) => spawnAgent(agent, taskId, options))
  );

  return results;
}
