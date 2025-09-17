import { api } from "@cmux/convex/api";
import type { Id } from "@cmux/convex/dataModel";
import { type AgentConfig } from "@cmux/shared/agentConfig";
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
    // Mark task as complete (retry on OCC)
    await retryOnOptimisticConcurrency(() =>
      getConvex().mutation(api.taskRuns.complete, {
        teamSlugOrId,
        id: taskRunId,
        exitCode,
      })
    );

    serverLogger.info(`[AgentSpawner] Updated taskRun ${taskRunId} as completed with exit code ${exitCode}`);

    // Check if all runs are complete and evaluate crown
    const taskRunData = await getConvex().query(api.taskRuns.get, {
      teamSlugOrId,
      id: taskRunId,
    });

    serverLogger.info(
      `[AgentSpawner] Task run data retrieved: ${taskRunData ? "found" : "not found"}`
    );

    if (taskRunData) {
      // Perform auto-commit and push BEFORE crown evaluation so diffs are available to the diff viewer source of truth
      const task = await getConvex().query(api.tasks.getById, {
        teamSlugOrId,
        id: taskRunData.taskId,
      });

      if (task) {
        serverLogger.info(
          `[AgentSpawner] Performing auto-commit for ${agent.name} (pre-crown)`
        );

        try {
          await performAutoCommitAndPush(
            vscodeInstance,
            agent,
            taskRunId,
            task.text,
            teamSlugOrId
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
      }

      serverLogger.info(
        `[AgentSpawner] Calling checkAndEvaluateCrown for task ${taskRunData.taskId}`
      );

      const winnerId = await getConvex().mutation(
        api.tasks.checkAndEvaluateCrown,
        {
          teamSlugOrId,
          taskId: taskRunData.taskId,
        }
      );

      serverLogger.info(
        `[AgentSpawner] checkAndEvaluateCrown returned: ${winnerId}`
      );

      // If winnerId is "pending", trigger Claude Code evaluation
      if (winnerId === "pending") {
        serverLogger.info(`[AgentSpawner] ==========================================`);
        serverLogger.info(`[AgentSpawner] CROWN EVALUATION NEEDED - TRIGGERING NOW`);
        serverLogger.info(`[AgentSpawner] Task ID: ${taskRunData.taskId}`);
        serverLogger.info(`[AgentSpawner] ==========================================`);

        // Trigger crown evaluation immediately (we already committed/pushed)
        try {
          // Check if evaluation is already in progress
          const taskNow = await getConvex().query(api.tasks.getById, {
            teamSlugOrId,
            id: taskRunData.taskId,
          });
          if (taskNow?.crownEvaluationError === "in_progress") {
            serverLogger.info(
              `[AgentSpawner] Crown evaluation already in progress for task ${taskRunData.taskId}`
            );
          } else {
            await evaluateCrown(taskRunData.taskId, teamSlugOrId);
            serverLogger.info(`[AgentSpawner] Crown evaluation completed successfully`);

            // Check if this task run won
            const updatedTaskRun = await getConvex().query(api.taskRuns.get, {
              teamSlugOrId,
              id: taskRunId,
            });
            if (updatedTaskRun?.isCrowned) {
              serverLogger.info(
                `[AgentSpawner] 🏆 This task run won the crown! ${agent.name} is the winner!`
              );
            }
          }
        } catch (error) {
          serverLogger.error(`[AgentSpawner] Crown evaluation failed:`, error);
          // Periodic checker will retry
        }
      } else if (winnerId) {
        serverLogger.info(
          `[AgentSpawner] Task completed with winner: ${winnerId}`
        );

        // For single agent scenario, auto-PR if enabled (commit already done above)
        const taskRuns = await getConvex().query(api.taskRuns.getByTask, {
          teamSlugOrId,
          taskId: taskRunData.taskId,
        });

        if (taskRuns.length === 1) {
          serverLogger.info(
            `[AgentSpawner] Single agent scenario - checking auto-PR settings`
          );

          const ws = await getConvex().query(api.workspaceSettings.get, {
            teamSlugOrId,
          });
          const autoPrEnabled = ws?.autoPrEnabled ?? false;

          if (autoPrEnabled && winnerId) {
            serverLogger.info(
              `[AgentSpawner] Triggering auto-PR for single agent completion`
            );
            const githubToken = await getGitHubTokenFromKeychain();
            try {
              await createPullRequestForWinner(
                winnerId,
                taskRunData.taskId,
                githubToken || undefined,
                teamSlugOrId
              );
              serverLogger.info(
                `[AgentSpawner] Auto-PR completed for single agent`
              );
            } catch (error) {
              serverLogger.error(
                `[AgentSpawner] Auto-PR failed for single agent:`,
                error
              );
            }
          } else {
            serverLogger.info(
              `[AgentSpawner] Auto-PR disabled or not applicable for single agent`
            );
          }
        }
      } else {
        serverLogger.info(
          `[AgentSpawner] No crown evaluation needed (winnerId: ${winnerId})`
        );
      }
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
