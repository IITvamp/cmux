import { api } from "@cmux/convex/api";
import type { Id } from "@cmux/convex/dataModel";
import { type AgentConfig } from "@cmux/shared/agentConfig";
import { captureGitDiff } from "./captureGitDiff.js";
import { createPullRequestForWinner, evaluateCrown } from "./crownEvaluator.js";
import performAutoCommitAndPush from "./performAutoCommitAndPush.js";
import { getConvex } from "./utils/convexClient.js";
import { serverLogger } from "./utils/fileLogger.js";
import { getGitHubTokenFromKeychain } from "./utils/getGitHubToken.js";
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
    // Mark task as complete and check if all tasks are done (retry on OCC)
    const { allCompleted, taskId } = await retryOnOptimisticConcurrency(() =>
      getConvex().mutation(api.taskRuns.markCompleteFromWorker, {
        taskRunId,
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
      `[AgentSpawner] Updated taskRun ${taskRunId} as completed`
    );

    if (allCompleted) {
      serverLogger.info(
        `[AgentSpawner] All task runs complete for task ${taskId}. Triggering crown evaluation.`
      );

      // Trigger crown evaluation immediately
      try {
        await evaluateCrown({
          taskId,
          teamSlugOrId,
        });
        serverLogger.info(
          `[AgentSpawner] Crown evaluation completed for task ${taskId}`
        );
      } catch (error) {
        serverLogger.error(
          `[AgentSpawner] Crown evaluation failed for task ${taskId}:`,
          error
        );
      }
    }

    // Get task run data for auto-commit
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

      // Crown evaluation is now handled automatically by Convex when all tasks are complete
      // Just wait for auto-commit to complete
      await autoCommitPromise;

      // Check if this run won the crown (after evaluation completes)
      const crownCheckPromise: Promise<void> = (async () => {
        // Wait a bit for crown evaluation to potentially complete
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const updatedTaskRun = await getConvex().query(api.taskRuns.get, {
          teamSlugOrId,
          id: taskRunId,
        });

        if (updatedTaskRun?.isCrowned) {
          serverLogger.info(
            `[AgentSpawner] 🏆 This task run won the crown! ${agent.name} is the winner!`
          );

          // Check if auto-PR is enabled for the crowned run
          const ws = await getConvex().query(api.workspaceSettings.get, {
            teamSlugOrId,
          });
          const autoPrEnabled = ws?.autoPrEnabled ?? false;

          if (autoPrEnabled) {
            serverLogger.info(
              `[AgentSpawner] Triggering auto-PR for crowned winner`
            );

            const githubToken = await getGitHubTokenFromKeychain();

            try {
              await createPullRequestForWinner(
                taskRunId,
                taskRunData.taskId,
                githubToken || undefined,
                teamSlugOrId
              );
              serverLogger.info(
                `[AgentSpawner] Auto-PR completed for crowned winner`
              );
            } catch (error) {
              serverLogger.error(
                `[AgentSpawner] Auto-PR failed for crowned winner:`,
                error
              );
            }
          }
        }
      })();

      // Don't wait for crown check as it's non-critical
      crownCheckPromise.catch((error) => {
        serverLogger.warn(`[AgentSpawner] Error checking crown status:`, error);
      });
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
