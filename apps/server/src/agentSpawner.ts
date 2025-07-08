import type { Server } from "socket.io";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@coderouter/shared";
import { createTerminal, type GlobalTerminal } from "./terminal.js";
import { AGENT_CONFIGS, type AgentConfig } from "./agentConfig.js";
import { getWorktreePath, setupProjectWorkspace } from "./workspace.js";
import type { Id } from "@coderouter/convex/dataModel";
import { api } from "@coderouter/convex/api";
import { convex } from "./utils/convexClient.js";

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

    // Use taskRunId as terminal ID
    const terminalId = taskRunId;

    // Create terminal for the agent
    const terminal = createTerminal(terminalId, globalTerminals, io, {
      cwd: workspaceResult.worktreePath,
      command: agent.command,
      args: agent.args(options.taskDescription),
      env: {
        ...process.env,
        ...agent.env,
        PROMPT: options.taskDescription,
      } as Record<string, string>,
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
  }
): Promise<AgentSpawnResult[]> {
  // Spawn all agents in parallel
  const spawnPromises = AGENT_CONFIGS.map((agent: AgentConfig) =>
    spawnAgent(agent, taskId, globalTerminals, io, options)
  );

  return Promise.all(spawnPromises);
}