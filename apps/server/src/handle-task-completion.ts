import { api } from "@cmux/convex/api";
import type { Id } from "@cmux/convex/dataModel";
import { type AgentConfig } from "@cmux/shared/agentConfig";
import { captureGitDiff } from "./captureGitDiff.js";
import performAutoCommitAndPush from "./performAutoCommitAndPush.js";
import { getConvex } from "./utils/convexClient.js";
import { serverLogger } from "./utils/fileLogger.js";
import type { VSCodeInstance } from "./vscode/VSCodeInstance.js";
import { retryOnOptimisticConcurrency } from "./utils/convexRetry.js";

// Handler for completing the task
export async function handleTaskCompletion({
  taskRunId,
  agent,
  exitCode = 0,
  worktreePath,
  vscodeInstance,
  teamSlugOrId,
}: {
  taskRunId: Id<"taskRuns">;
  agent: AgentConfig;
  exitCode: number;
  worktreePath: string;
  vscodeInstance: VSCodeInstance;
  teamSlugOrId: string;
}) {
  try {
    // Mark task as complete (retry on OCC)
    await retryOnOptimisticConcurrency(() =>
      getConvex().mutation(api.taskRuns.complete, {
        teamSlugOrId,
        id: taskRunId,
        exitCode,
      })
    );

    // Capture git diff before marking as complete
    serverLogger.info(
      `[AgentSpawner] ============================================`
    );
    serverLogger.info(`[AgentSpawner] CAPTURING GIT DIFF FOR ${agent.name}`);
    serverLogger.info(`[AgentSpawner] Task Run ID: ${taskRunId}`);
    serverLogger.info(`[AgentSpawner] Worktree Path: ${worktreePath}`);
    serverLogger.info(
      `[AgentSpawner] VSCode Instance Connected: ${vscodeInstance.isWorkerConnected()}`
    );
    serverLogger.info(
      `[AgentSpawner] ============================================`
    );

    // Collect the relevant diff via the shared worker script
    const gitDiff = await captureGitDiff(vscodeInstance, worktreePath);
    serverLogger.info(
      `[AgentSpawner] Captured git diff for ${agent.name}: ${gitDiff.length} chars`
    );
    serverLogger.info(
      `[AgentSpawner] First 100 chars of diff: ${gitDiff.substring(0, 100)}`
    );

    // Do not write diffs to Convex logs; crown and UI fetch diffs directly.
    if (!gitDiff || gitDiff.length === 0) {
      serverLogger.warn(
        `[AgentSpawner] No git diff captured for ${agent.name} (${taskRunId})`
      );
    }

    serverLogger.info(
      `[AgentSpawner] Updated taskRun ${taskRunId} as completed with exit code ${exitCode}`
    );

    // Check if all runs are complete and evaluate crown
    const taskRunData = await getConvex().query(api.taskRuns.get, {
      teamSlugOrId,
      id: taskRunId,
    });

    serverLogger.info(
      `[AgentSpawner] Task run data retrieved: ${taskRunData ? "found" : "not found"}`
    );

    if (taskRunData) {
      const task = await getConvex().query(api.tasks.getById, {
        teamSlugOrId,
        id: taskRunData.taskId,
      });

      if (!task) {
        serverLogger.error(
          `[AgentSpawner] Task ${taskRunData.taskId} not found for completion flow`
        );
        throw new Error(`Task ${taskRunData.taskId} not found`);
      }

      const autoCommitPromise: Promise<void> = (async () => {
        serverLogger.info(
          `[AgentSpawner] Performing auto-commit for ${agent.name}`
        );

        try {
          await performAutoCommitAndPush(
            vscodeInstance,
            agent,
            taskRunId,
            task.text,
            teamSlugOrId,
            gitDiff
          );
          serverLogger.info(
            `[AgentSpawner] Auto-commit completed successfully for ${agent.name}`
          );
        } catch (error) {
          serverLogger.error(
            `[AgentSpawner] Auto-commit failed for ${agent.name}:`,
            error
          );
        }
      })();

      await autoCommitPromise;

      // Crown evaluation now handled exclusively by the worker that finishes last.
    }

    // Schedule container stop based on settings
    const containerSettings = await getConvex().query(
      api.containerSettings.getEffective,
      { teamSlugOrId }
    );

    if (containerSettings.autoCleanupEnabled) {
      if (containerSettings.stopImmediatelyOnCompletion) {
        // Stop container immediately
        serverLogger.info(
          `[AgentSpawner] Stopping container immediately as per settings`
        );

        // Stop the VSCode instance
        await vscodeInstance.stop();
      } else {
        // Schedule stop after review period
        const reviewPeriodMs =
          containerSettings.reviewPeriodMinutes * 60 * 1000;
        const scheduledStopAt = Date.now() + reviewPeriodMs;

        await retryOnOptimisticConcurrency(() =>
          getConvex().mutation(api.taskRuns.updateScheduledStop, {
            teamSlugOrId,
            id: taskRunId,
            scheduledStopAt,
          })
        );

        serverLogger.info(
          `[AgentSpawner] Scheduled container stop for ${new Date(scheduledStopAt).toISOString()}`
        );
      }
    }
  } catch (error) {
    serverLogger.error(`[AgentSpawner] Error handling task completion:`, error);
  }
}
