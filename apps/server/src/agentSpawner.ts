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
import type { Server } from "socket.io";
import { createTerminal, type GlobalTerminal } from "./terminal.js";
import { convex } from "./utils/convexClient.js";
import { getWorktreePath, setupProjectWorkspace } from "./workspace.js";

export interface AgentSpawnResult {
  agentName: string;
  terminalId: string;
  taskRunId: string | Id<"taskRuns">;
  worktreePath: string;
  success: boolean;
  error?: string;
}

export async function spawnAgent(
  agent: AgentConfig,
  taskId: string | Id<"tasks">,
  globalTerminals: Map<string, GlobalTerminal>,
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
  }
): Promise<AgentSpawnResult> {
  try {
    // Create a task run for this specific agent
    const taskRunId = await convex.mutation(api.taskRuns.create, {
      taskId: taskId as Id<"tasks">,
      prompt: `${options.taskDescription} (${agent.name})`,
    });

    // Get worktree path for this specific agent
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

    // Update the task run with the worktree path
    await convex.mutation(api.taskRuns.updateWorktreePath, {
      id: taskRunId,
      worktreePath: workspaceResult.worktreePath,
    });

    // Use taskRunId as terminal ID
    const terminalId = taskRunId;

    // Fetch API keys from Convex
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

    // Create terminal for the agent
    const terminal = createTerminal(terminalId, globalTerminals, io, {
      cwd: workspaceResult.worktreePath,
      command: agent.command,
      args: agent.args(options.taskDescription),
      env: envVars,
      taskRunId,
    });

    if (!terminal) {
      return {
        agentName: agent.name,
        terminalId: "",
        taskRunId,
        worktreePath: workspaceResult.worktreePath,
        success: false,
        error: "Failed to create terminal",
      };
    }

    return {
      agentName: agent.name,
      terminalId,
      taskRunId,
      worktreePath: workspaceResult.worktreePath,
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
      io,
      options
    );
    results.push(result);
  }

  return results;
}
