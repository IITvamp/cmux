import { api } from "@cmux/convex/api";
import type { Id } from "@cmux/convex/dataModel";
import {
  AGENT_CONFIGS,
  type AgentConfig,
  type EnvironmentResult,
} from "@cmux/shared/agentConfig";
import type {
  WorkerCreateTerminal,
  WorkerTerminalExit,
  WorkerTerminalFailed,
  WorkerTerminalIdle,
} from "@cmux/shared/worker-schemas";
import { handleTaskCompletion } from "./handle-task-completion.js";
import { sanitizeTmuxSessionName } from "./sanitizeTmuxSessionName.js";
import {
  generateNewBranchName,
  generateUniqueBranchNames,
  generateUniqueBranchNamesFromTitle,
} from "./utils/branchNameGenerator.js";
import { convex } from "./utils/convexClient.js";
import { serverLogger } from "./utils/fileLogger.js";
import { DockerVSCodeInstance } from "./vscode/DockerVSCodeInstance.js";
import { MorphVSCodeInstance } from "./vscode/MorphVSCodeInstance.js";
import { VSCodeInstance } from "./vscode/VSCodeInstance.js";
import { getWorktreePath, setupProjectWorkspace } from "./workspace.js";

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
  taskId: Id<"tasks">,
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
    theme?: "dark" | "light" | "system";
    newBranch?: string; // Optional pre-generated branch name
  }
): Promise<AgentSpawnResult> {
  try {
    const newBranch =
      options.newBranch ||
      (await generateNewBranchName(options.taskDescription));
    serverLogger.info(
      `[AgentSpawner] New Branch: ${newBranch}, Base Branch: ${
        options.branch ?? "(auto)"
      }`
    );

    // Create a task run for this specific agent
    const taskRunId = await convex.mutation(api.taskRuns.create, {
      taskId: taskId,
      prompt: `${options.taskDescription} (${agent.name})`,
      agentName: agent.name,
      newBranch,
    });

    // Fetch the task to get image storage IDs
    const task = await convex.query(api.tasks.getById, {
      id: taskId,
    });

    // Process prompt to handle images
    let processedTaskDescription = options.taskDescription;
    const imageFiles: Array<{ path: string; base64: string }> = [];

    // Handle images from either the options (for backward compatibility) or from the task
    let imagesToProcess = options.images || [];

    // If task has images with storage IDs, download them
    if (task && task.images && task.images.length > 0) {
      const imageUrlsResult = await convex.query(api.storage.getUrls, {
        storageIds: task.images.map((image) => image.storageId),
      });
      const downloadedImages = await Promise.all(
        task.images.map(async (taskImage) => {
          const imageUrl = imageUrlsResult.find(
            (url) => url.storageId === taskImage.storageId
          );
          if (imageUrl) {
            // Download image from Convex storage
            const response = await fetch(imageUrl.url);
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString("base64");
            return {
              src: `data:image/png;base64,${base64}`,
              fileName: taskImage.fileName,
              altText: taskImage.altText,
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
      serverLogger.info(
        `[AgentSpawner] Processing ${imagesToProcess.length} images`
      );
      serverLogger.info(
        `[AgentSpawner] Original task description: ${options.taskDescription}`
      );

      // Create image files and update prompt
      imagesToProcess.forEach((image, index) => {
        // Sanitize filename to remove special characters
        let fileName = image.fileName || `image_${index + 1}.png`;
        serverLogger.info(`[AgentSpawner] Original filename: ${fileName}`);
        // Replace non-ASCII characters and spaces with underscores
        fileName = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/\s+/g, "_");
        serverLogger.info(`[AgentSpawner] Sanitized filename: ${fileName}`);

        const imagePath = `/root/prompt/${fileName}`;
        imageFiles.push({
          path: imagePath,
          base64: image.src.split(",")[1] || image.src, // Remove data URL prefix if present
        });

        // Replace image reference in prompt with file path
        // First try to replace the original filename (exact match, no word boundaries)
        if (image.fileName) {
          const beforeReplace = processedTaskDescription;
          // Escape special regex characters in the filename
          const escapedFileName = image.fileName.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          );
          processedTaskDescription = processedTaskDescription.replace(
            new RegExp(escapedFileName, "g"),
            imagePath
          );
          if (beforeReplace !== processedTaskDescription) {
            serverLogger.info(
              `[AgentSpawner] Replaced "${image.fileName}" with "${imagePath}"`
            );
          } else {
            serverLogger.warn(
              `[AgentSpawner] Failed to find "${image.fileName}" in prompt text`
            );
          }
        }

        // Also replace just the filename without extension in case it appears that way
        const nameWithoutExt = image.fileName?.replace(/\.[^/.]+$/, "");
        if (
          nameWithoutExt &&
          processedTaskDescription.includes(nameWithoutExt)
        ) {
          const beforeReplace = processedTaskDescription;
          const escapedName = nameWithoutExt.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          );
          processedTaskDescription = processedTaskDescription.replace(
            new RegExp(escapedName, "g"),
            imagePath
          );
          if (beforeReplace !== processedTaskDescription) {
            serverLogger.info(
              `[AgentSpawner] Replaced "${nameWithoutExt}" with "${imagePath}"`
            );
          }
        }
      });

      serverLogger.info(
        `[AgentSpawner] Processed task description: ${processedTaskDescription}`
      );
    }

    let envVars: Record<string, string> = {
      CMUX_PROMPT: processedTaskDescription,
      CMUX_TASK_RUN_ID: taskRunId,
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

    // Fetch API keys from Convex
    const apiKeys = await convex.query(api.apiKeys.getAllForAgents);

    // Add required API keys from Convex
    if (agent.apiKeys) {
      for (const keyConfig of agent.apiKeys) {
        const key = apiKeys[keyConfig.envVar];
        if (key && key.trim().length > 0) {
          envVars[keyConfig.envVar] = key;
        }
      }
    }

    // Replace $PROMPT placeholders in args with $CMUX_PROMPT token for shell-time expansion
    const processedArgs = agent.args.map((arg) => {
      if (arg.includes("$PROMPT")) {
        return arg.replace(/\$PROMPT/g, "$CMUX_PROMPT");
      }
      return arg;
    });

    const agentCommand = `${agent.command} ${processedArgs.join(" ")}`;

    // Build the tmux session command that will be sent via socket.io
    const tmuxSessionName = sanitizeTmuxSessionName(
      `${agent.name}-${taskRunId.slice(-8)}`
    );

    serverLogger.info(
      `[AgentSpawner] Building command for agent ${agent.name}:`
    );
    serverLogger.info(`  Raw command: ${agent.command}`);
    serverLogger.info(`  Processed args: ${processedArgs.join(" ")}`);
    serverLogger.info(`  Agent command: ${agentCommand}`);
    serverLogger.info(`  Tmux session name: ${tmuxSessionName}`);
    serverLogger.info(
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
        taskRunId,
        taskId,
        theme: options.theme,
      });

      worktreePath = "/root/workspace";
    } else {
      // For Docker, set up worktree as before
      const worktreeInfo = await getWorktreePath({
        repoUrl: options.repoUrl,
        branch: newBranch,
      });

      // Setup workspace
      const workspaceResult = await setupProjectWorkspace({
        repoUrl: options.repoUrl,
        // If not provided, setupProjectWorkspace detects default from origin
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

      serverLogger.info(
        `[AgentSpawner] Creating DockerVSCodeInstance for ${agent.name}`
      );
      vscodeInstance = new DockerVSCodeInstance({
        workspacePath: worktreePath,
        agentName: agent.name,
        taskRunId,
        taskId,
        theme: options.theme,
      });
    }

    // Update the task run with the worktree path
    await convex.mutation(api.taskRuns.updateWorktreePath, {
      id: taskRunId,
      worktreePath: worktreePath,
    });

    // Store the VSCode instance
    // VSCodeInstance.getInstances().set(vscodeInstance.getInstanceId(), vscodeInstance);

    serverLogger.info(`Starting VSCode instance for agent ${agent.name}...`);

    // Start the VSCode instance
    const vscodeInfo = await vscodeInstance.start();
    const vscodeUrl = vscodeInfo.workspaceUrl;

    serverLogger.info(
      `VSCode instance spawned for agent ${agent.name}: ${vscodeUrl}`
    );

    // Start file watching for real-time diff updates
    serverLogger.info(
      `[AgentSpawner] Starting file watch for ${agent.name} at ${worktreePath}`
    );
    vscodeInstance.startFileWatch(worktreePath);

    // Track if this terminal already failed (to avoid completing later)
    let hasFailed = false;

    // Set up terminal-exit event handler
    vscodeInstance.on("terminal-exit", async (data: WorkerTerminalExit) => {
      serverLogger.info(
        `[AgentSpawner] Terminal exited for ${agent.name}:`,
        data
      );

      if (data.terminalId === terminalId) {
        if (hasFailed) {
          serverLogger.warn(
            `[AgentSpawner] Not completing ${agent.name} (already marked failed)`
          );
          return;
        }
        // CRITICAL: Add a delay to ensure changes are written to disk
        serverLogger.info(
          `[AgentSpawner] Waiting 3 seconds for file system to settle before capturing git diff...`
        );
        await new Promise((resolve) => setTimeout(resolve, 3000));

        await handleTaskCompletion({
          taskRunId,
          agent,
          exitCode: data.exitCode ?? 0,
          worktreePath,
          vscodeInstance,
        });
      }
    });

    // Set up file change event handler for real-time diff updates
    vscodeInstance.on("file-changes", async (data) => {
      serverLogger.info(
        `[AgentSpawner] File changes detected for ${agent.name}:`,
        { changeCount: data.changes.length, taskRunId: data.taskRunId }
      );

      // On-demand diffs: no longer persisting incremental diffs to Convex
    });

    // Set up task-complete event handler (from project file detection)
    vscodeInstance.on("task-complete", async (data) => {
      serverLogger.info(
        `[AgentSpawner] Task complete detected for ${agent.name}:`,
        data
      );
      if (hasFailed) {
        serverLogger.warn(
          `[AgentSpawner] Ignoring task completion for ${agent.name} (already marked failed)`
        );
        return;
      }

      // Debug logging to understand what's being compared
      serverLogger.info(`[AgentSpawner] Task completion comparison:`);
      serverLogger.info(`[AgentSpawner]   data.taskRunId: "${data.taskRunId}"`);
      serverLogger.info(`[AgentSpawner]   taskRunId: "${taskRunId}"`);
      serverLogger.info(
        `[AgentSpawner]   Match: ${data.taskRunId === taskRunId}`
      );

      // Update the task run as completed
      if (data.taskRunId === taskRunId) {
        serverLogger.info(
          `[AgentSpawner] Task ID matched! Marking task as complete for ${agent.name}`
        );
        // CRITICAL: Add a delay to ensure changes are written to disk
        serverLogger.info(
          `[AgentSpawner] Waiting 3 seconds for file system to settle before capturing git diff...`
        );
        await new Promise((resolve) => setTimeout(resolve, 3000));

        await handleTaskCompletion({
          taskRunId,
          agent,
          exitCode: 0,
          worktreePath,
          vscodeInstance,
        });
      } else {
        serverLogger.warn(
          `[AgentSpawner] Task ID did not match, ignoring task complete event`
        );
      }
    });

    // Set up terminal-idle event handler (legacy; ignore for deterministic agents like OpenCode)
    vscodeInstance.on("terminal-idle", async (data: WorkerTerminalIdle) => {
      serverLogger.info(
        `[AgentSpawner] Terminal idle detected for ${agent.name}:`,
        data
      );
      if (hasFailed) {
        serverLogger.warn(
          `[AgentSpawner] Ignoring idle for ${agent.name} (already marked failed)`
        );
        return;
      }

      // Debug logging to understand what's being compared
      serverLogger.info(`[AgentSpawner] Terminal idle comparison:`);
      serverLogger.info(`[AgentSpawner]   data.taskRunId: "${data.taskRunId}"`);
      serverLogger.info(`[AgentSpawner]   taskRunId: "${taskRunId}"`);
      serverLogger.info(
        `[AgentSpawner]   Match: ${data.taskRunId === taskRunId}`
      );

      // Update the task run as completed
      if (data.taskRunId === taskRunId) {
        serverLogger.info(
          `[AgentSpawner] Task ID matched! Marking task as complete for ${agent.name}`
        );
        vscodeInstance.stopFileWatch();
        await handleTaskCompletion({
          taskRunId,
          agent,
          exitCode: 0,
          worktreePath,
          vscodeInstance,
        });
      } else {
        serverLogger.warn(
          `[AgentSpawner] Task ID did not match, ignoring idle event`
        );
      }
    });

    // Set up terminal-failed event handler
    vscodeInstance.on("terminal-failed", async (data: WorkerTerminalFailed) => {
      try {
        serverLogger.error(
          `[AgentSpawner] Terminal failed for ${agent.name}:`,
          data
        );
        if (data.taskRunId !== taskRunId) {
          serverLogger.warn(
            `[AgentSpawner] Failure event taskRunId mismatch; ignoring`
          );
          return;
        }
        hasFailed = true;

        // Append error to log for context
        if (data.errorMessage) {
          await convex.mutation(api.taskRuns.appendLogPublic, {
            id: taskRunId,
            content: `\n\n=== ERROR ===\n${data.errorMessage}\n=== END ERROR ===\n`,
          });
        }

        // Mark the run as failed with error message
        await convex.mutation(api.taskRuns.fail, {
          id: taskRunId,
          errorMessage: data.errorMessage || "Terminal failed",
          // WorkerTerminalFailed does not include exitCode in schema; default to 1
          exitCode: 1,
        });

        serverLogger.info(
          `[AgentSpawner] Marked taskRun ${taskRunId} as failed`
        );
      } catch (error) {
        serverLogger.error(
          `[AgentSpawner] Error handling terminal-failed:`,
          error
        );
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
      serverLogger.info(
        `[AgentSpawner] Prepared ${authFiles.length} auth files for agent ${agent.name}`
      );
    }

    // After VSCode instance is started, create the terminal with tmux session
    serverLogger.info(
      `[AgentSpawner] Preparing to send terminal creation command for ${agent.name}`
    );

    // Wait for worker connection if not already connected
    if (!vscodeInstance.isWorkerConnected()) {
      serverLogger.info(`[AgentSpawner] Waiting for worker connection...`);
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          serverLogger.error(
            `[AgentSpawner] Timeout waiting for worker connection`
          );
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
      serverLogger.error(
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

    const actualCommand = agent.command;
    const actualArgs = processedArgs;

    // Build a shell command string so CMUX env vars expand inside tmux session
    const shellEscaped = (s: string) => {
      // If this arg references any CMUX env var (e.g., $CMUX_PROMPT, $CMUX_TASK_RUN_ID),
      // wrap in double quotes to allow shell expansion.
      if (s.includes("$CMUX_")) {
        return `"${s.replace(/"/g, '\\"')}"`;
      }
      // Otherwise single-quote and escape any existing single quotes
      return `'${s.replace(/'/g, "'\\''")}'`;
    };
    const commandString = [actualCommand, ...actualArgs]
      .map(shellEscaped)
      .join(" ");

    // Log the actual command for Codex agents to debug notify command
    if (agent.name.toLowerCase().includes("codex")) {
      serverLogger.info(
        `[AgentSpawner] Codex command string: ${commandString}`
      );
      serverLogger.info(`[AgentSpawner] Codex raw args:`, actualArgs);
    }

    // For Codex agents, use direct command execution to preserve notify argument
    // The notify command contains complex JSON that gets mangled through shell layers
    const tmuxArgs = agent.name.toLowerCase().includes("codex")
      ? [
          "new-session",
          "-d",
          "-s",
          tmuxSessionName,
          "-c",
          "/root/workspace",
          actualCommand,
          ...actualArgs.map((arg) => {
            // Replace $CMUX_PROMPT with actual prompt value
            if (arg === "$CMUX_PROMPT") {
              return processedTaskDescription;
            }
            return arg;
          }),
        ]
      : [
          "new-session",
          "-d",
          "-s",
          tmuxSessionName,
          "bash",
          "-lc",
          `exec ${commandString}`,
        ];

    const terminalCreationCommand: WorkerCreateTerminal = {
      terminalId: tmuxSessionName,
      command: "tmux",
      args: tmuxArgs,
      cols: 80,
      rows: 74,
      env: envVars,
      taskRunId,
      agentModel: agent.name,
      authFiles,
      startupCommands,
      cwd: "/root/workspace",
    };

    serverLogger.info(
      `[AgentSpawner] Sending terminal creation command at ${new Date().toISOString()}:`
    );
    serverLogger.info(`  Terminal ID: ${tmuxSessionName}`);
    // serverLogger.info(
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
    serverLogger.info(`  isCloudMode:`, options.isCloudMode);

    // For Morph instances, we need to clone the repository first
    if (options.isCloudMode) {
      serverLogger.info(
        `[AgentSpawner] Cloning repository for Morph instance...`
      );

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
                serverLogger.error(
                  "Timeout waiting for git clone",
                  timeoutError
                );
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

              const { stdout, stderr, exitCode } = result.data;
              serverLogger.info(`[AgentSpawner] Git clone stdout:`, stdout);
              if (stderr) {
                serverLogger.info(`[AgentSpawner] Git clone stderr:`, stderr);
              }

              if (exitCode === 0) {
                serverLogger.info(
                  `[AgentSpawner] Repository cloned successfully`
                );
                resolve({ success: true });
              } else {
                serverLogger.error(
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
      serverLogger.info(
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
              serverLogger.error(
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
          const base64Data = imageFile.base64.includes(",")
            ? imageFile.base64.split(",")[1]
            : imageFile.base64;
          const buffer = Buffer.from(base64Data, "base64");

          // Create form data
          const formData = new FormData();
          const blob = new Blob([buffer], { type: "image/png" });
          formData.append("image", blob, "image.png");
          formData.append("path", imageFile.path);

          // Get worker port from VSCode instance
          const workerPort =
            vscodeInstance instanceof DockerVSCodeInstance
              ? (vscodeInstance as DockerVSCodeInstance).getPorts()?.worker
              : "39377";

          const uploadUrl = `http://localhost:${workerPort}/upload-image`;

          serverLogger.info(`[AgentSpawner] Uploading image to ${uploadUrl}`);

          const response = await fetch(uploadUrl, {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`Upload failed: ${error}`);
          }

          const result = await response.json();
          serverLogger.info(
            `[AgentSpawner] Successfully uploaded image: ${result.path} (${result.size} bytes)`
          );
        } catch (error) {
          serverLogger.error(
            `[AgentSpawner] Failed to upload image ${imageFile.path}:`,
            error
          );
        }
      }
    }

    // Send the terminal creation command
    serverLogger.info(
      `[AgentSpawner] About to emit worker:create-terminal at ${new Date().toISOString()}`
    );
    serverLogger.info(
      `[AgentSpawner] Socket connected:`,
      workerSocket.connected
    );
    serverLogger.info(`[AgentSpawner] Socket id:`, workerSocket.id);

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        serverLogger.error(
          `[AgentSpawner] Timeout waiting for terminal creation response after 30s`
        );
        reject(new Error("Timeout waiting for terminal creation"));
      }, 30000);

      workerSocket.emit(
        "worker:create-terminal",
        terminalCreationCommand,
        (result) => {
          clearTimeout(timeout);
          serverLogger.info(
            `[AgentSpawner] Got response from worker:create-terminal at ${new Date().toISOString()}:`,
            result
          );
          if (result.error) {
            reject(result.error);
            return;
          } else {
            serverLogger.info("Terminal created successfully", result);
            resolve(result.data);
          }
        }
      );
      serverLogger.info(
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
    serverLogger.error("Error spawning agent", error);
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
  taskId: Id<"tasks">,
  options: {
    repoUrl: string;
    branch?: string;
    taskDescription: string;
    prTitle?: string;
    selectedAgents?: string[];
    isCloudMode?: boolean;
    images?: Array<{
      src: string;
      fileName?: string;
      altText: string;
    }>;
    theme?: "dark" | "light" | "system";
  }
): Promise<AgentSpawnResult[]> {
  // If selectedAgents is provided, filter AGENT_CONFIGS to only include selected agents
  const agentsToSpawn = options.selectedAgents
    ? AGENT_CONFIGS.filter((agent) =>
        options.selectedAgents!.includes(agent.name)
      )
    : AGENT_CONFIGS;

  // Generate unique branch names for all agents at once to ensure no collisions
  const branchNames = options.prTitle
    ? generateUniqueBranchNamesFromTitle(options.prTitle!, agentsToSpawn.length)
    : await generateUniqueBranchNames(
        options.taskDescription,
        agentsToSpawn.length
      );

  serverLogger.info(
    `[AgentSpawner] Generated ${branchNames.length} unique branch names for agents`
  );

  // Spawn all agents in parallel with their pre-generated branch names
  const results = await Promise.all(
    agentsToSpawn.map((agent, index) =>
      spawnAgent(agent, taskId, {
        ...options,
        newBranch: branchNames[index],
      })
    )
  );

  return results;
}
