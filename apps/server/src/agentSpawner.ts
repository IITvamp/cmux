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
} from "@coderouter/shared/agentConfig";
import archiver from "archiver";
import * as ignoreLib from "ignore";
import { exec } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";
import type { Server } from "socket.io";
import { type GlobalTerminal } from "./terminal.js";
import { convex } from "./utils/convexClient.js";
import { DockerVSCodeInstance } from "./vscode/DockerVSCodeInstance.js";
import { MorphVSCodeInstance } from "./vscode/MorphVSCodeInstance.js";
import { VSCodeInstance } from "./vscode/VSCodeInstance.js";
import { getWorktreePath, setupProjectWorkspace } from "./workspace.js";
const ignore = ignoreLib.default || ignoreLib;

const execAsync = promisify(exec);

async function zipRepository(repoPath: string): Promise<Buffer> {
  // Read .gitignore if it exists
  let gitignoreContent = "";
  try {
    gitignoreContent = await fs.readFile(
      path.join(repoPath, ".gitignore"),
      "utf-8"
    );
  } catch (_error) {
    // .gitignore doesn't exist, that's fine
  }

  // Create ignore instance with default patterns
  const ig = ignore();
  ig.add(".git");
  ig.add("node_modules");
  ig.add("dist");
  ig.add("build");

  if (gitignoreContent) {
    ig.add(gitignoreContent);
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);

    // Add files to archive, respecting gitignore
    const addDirectory = async (dir: string, archivePath: string = "") => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(repoPath, fullPath);

        if (!ig.ignores(relativePath)) {
          if (entry.isDirectory()) {
            await addDirectory(fullPath, path.join(archivePath, entry.name));
          } else {
            archive.file(fullPath, {
              name: path.join(archivePath, entry.name),
            });
          }
        }
      }
    };

    addDirectory(repoPath)
      .then(() => archive.finalize())
      .catch(reject);
  });
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
      ...process.env,
      ...agent.env,
      PROMPT: options.taskDescription,
    } as Record<string, string>;

    // Add required API keys from Convex
    if (agent.requiredApiKeys) {
      for (const keyConfig of agent.requiredApiKeys) {
        if (apiKeys[keyConfig.envVar]) {
          envVars[keyConfig.envVar] = apiKeys[keyConfig.envVar];
        }
      }
    }

    // Build the command that will be run inside VSCode
    // We'll create a script that sets up the environment and runs the agent
    const envExports = Object.entries(envVars)
      .filter(
        ([key]) =>
          key.startsWith("ANTHROPIC_") ||
          key.startsWith("GEMINI_") ||
          key === "PROMPT"
      )
      .map(([key, value]) => `export ${key}='${value}'`)
      .join("; ");

    const agentCommand = `${agent.command} ${agent.args(options.taskDescription).join(" ")}`;
    
    // Create a startup script that will:
    // 1. Export environment variables
    // 2. Create and attach to a tmux session with the agent
    const startupScript = `#!/bin/bash
${envExports}
tmux new-session -d -s ${agent.name} "${agentCommand}"
tmux attach-session -t ${agent.name}
`;

    let vscodeInstance: VSCodeInstance;
    let worktreePath: string;

    if (options.isCloudMode) {
      // For Morph, we need to:
      // 1. Clone the repo temporarily
      // 2. Zip it up
      // 3. Upload to Morph
      // 4. Create VSCode instance with initial command

      // Create a temporary directory for cloning
      const tempDir = path.join(process.cwd(), "temp", `morph-${taskRunId}`);
      await fs.mkdir(tempDir, { recursive: true });

      try {
        // Clone the repository
        await execAsync(`git clone ${options.repoUrl} ${tempDir}/repo`);

        if (options.branch && options.branch !== "main") {
          await execAsync(
            `cd ${tempDir}/repo && git checkout ${options.branch}`
          );
        }

        // Zip the repository
        const _zipBuffer = await zipRepository(path.join(tempDir, "repo"));

        // TODO: Upload zip to Morph storage
        // For now, we'll use the initial command to clone
        const morphInitialCommand = `git clone ${options.repoUrl} /root/workspace && cd /root/workspace && echo '${startupScript.replace(/'/g, "'\\''")}' > /tmp/start-agent.sh && chmod +x /tmp/start-agent.sh && /tmp/start-agent.sh`;

        vscodeInstance = new MorphVSCodeInstance({
          initialCommand: morphInitialCommand,
        });

        worktreePath = "/root/workspace";

        // Clean up temp directory
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Clean up on error
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        throw error;
      }
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

      vscodeInstance = new DockerVSCodeInstance({
        workspacePath: worktreePath,
        initialCommand: tmuxCommand,
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
    const result = await spawnAgent(
      agent,
      taskId,
      globalTerminals,
      vscodeInstances,
      io,
      options
    );
    results.push(result);
  }

  return results;
}
