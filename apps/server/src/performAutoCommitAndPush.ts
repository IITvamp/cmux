import { api } from "@cmux/convex/api";
import type { Id } from "@cmux/convex/dataModel";
import type { AgentConfig } from "@cmux/shared";
import { buildAutoCommitPushCommand } from "./utils/autoCommitPushCommand";
import { generateCommitMessageFromDiff } from "./utils/commitMessageGenerator";
import { convex } from "./utils/convexClient";
import { serverLogger } from "./utils/fileLogger";
import { workerExec } from "./utils/workerExec";
import { VSCodeInstance } from "./vscode/VSCodeInstance";

/**
 * Automatically commit and push changes when a task completes
 */

export default async function performAutoCommitAndPush(
  vscodeInstance: VSCodeInstance,
  agent: AgentConfig,
  taskRunId: Id<"taskRuns">,
  taskDescription: string
): Promise<void> {
  try {
    serverLogger.info(`[AgentSpawner] Starting auto-commit for ${agent.name}`);
    const workerSocket = vscodeInstance.getWorkerSocket();

    // Check if this run is crowned
    const taskRun = await convex.query(api.taskRuns.get, {
      id: taskRunId,
    });
    const isCrowned = taskRun?.isCrowned || false;

    serverLogger.info(
      `[AgentSpawner] Task run ${taskRunId} crowned status: ${isCrowned}`
    );

    // Use the newBranch from the task run, or fallback to old logic if not set
    const branchName =
      taskRun?.newBranch ||
      `cmux-${agent.name}-${taskRunId.slice(-8)}`
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/--+/g, "-");

    // Use task description as the main commit message
    const truncatedDescription =
      taskDescription.length > 72
        ? taskDescription.substring(0, 69) + "..."
        : taskDescription;

    // Collect relevant diff from worker via script (does not modify repo index)
    let commitMessage = "";
    try {
      const { stdout: diffOut } = await workerExec({
        workerSocket,
        command: "/bin/bash",
        args: ["-c", "/usr/local/bin/cmux-collect-relevant-diff.sh"],
        cwd: "/root/workspace",
        env: {},
        timeout: 30000,
      });
      serverLogger.info(
        `[AgentSpawner] Collected relevant diff (${diffOut.length} chars)`
      );

      const aiCommit = await generateCommitMessageFromDiff(diffOut);
      if (aiCommit && aiCommit.trim()) {
        commitMessage = aiCommit.trim();
      } else {
        console.warn(
          "No AI commit message generated, falling back to task-based message"
        );
        // Fallback to task-based message
        commitMessage = `${truncatedDescription}\n\nTask completed by ${agent.name} agent${
          isCrowned ? " 🏆" : ""
        }`;
      }
    } catch (e) {
      serverLogger.error(
        `[AgentSpawner] Failed to collect diff or generate commit message:`,
        e
      );
      // Fallback commit message
      commitMessage = `${truncatedDescription}\n\nTask completed by ${agent.name} agent${
        isCrowned ? " 🏆" : ""
      }`;
    }
    // Execute commit and push via worker:exec only
    if (!workerSocket || !vscodeInstance.isWorkerConnected()) {
      serverLogger.info(`{AgentSpawner] No worker connection for auto-commit`);
      return;
    }

    const autoCommitScript = buildAutoCommitPushCommand({
      branchName,
      commitMessage,
    });
    serverLogger.info(`[AgentSpawner] Executing auto-commit script...`);
    try {
      const { stdout, stderr, exitCode } = await workerExec({
        workerSocket,
        command: "bash",
        args: ["-c", `set -o pipefail; ${autoCommitScript}`],
        cwd: "/root/workspace",
        env: {},
        timeout: 60000,
      });
      serverLogger.info(`[AgentSpawner] Auto-commit script output:`, {
        exitCode,
        stdout: stdout?.slice(0, 2000),
        stderr: stderr?.slice(0, 2000),
      });
      if (exitCode !== 0) {
        const errMsg = `[AgentSpawner] Auto-commit script failed with exit code ${exitCode}`;
        serverLogger.error(errMsg);
        throw new Error(errMsg);
      }
    } catch (err) {
      serverLogger.error(`[AgentSpawner] Error executing auto-commit script`, err);
      throw err instanceof Error ? err : new Error(String(err));
    }

    if (isCrowned) {
      // Auto-PR is now always disabled
      serverLogger.info(
        `[AgentSpawner] Branch pushed (auto-PR disabled). Winner: ${agent.name} on ${branchName}`
      );
    } else {
      serverLogger.info(
        `[AgentSpawner] Auto-commit completed for ${agent.name} on branch ${branchName} (not crowned - branch pushed)`
      );
    }
  } catch (error) {
    serverLogger.error(`[AgentSpawner] Error in auto-commit and push:`, error);
    }
}
