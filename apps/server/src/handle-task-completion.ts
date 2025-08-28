import { api } from "@cmux/convex/api";
import type { Id } from "@cmux/convex/dataModel";
import { type AgentConfig } from "@cmux/shared/agentConfig";
import { captureGitDiff } from "./captureGitDiff.js";
import {
  createPullRequestForWinner,
  evaluateCrownWithClaudeCode,
} from "./crownEvaluator.js";
import performAutoCommitAndPush from "./performAutoCommitAndPush.js";
import { convex } from "./utils/convexClient.js";
import { serverLogger } from "./utils/fileLogger.js";
import { getGitHubTokenFromKeychain } from "./utils/getGitHubToken.js";
import type { VSCodeInstance } from "./vscode/VSCodeInstance.js";

// Handler for completing the task
export async function handleTaskCompletion({
  taskRunId,
  agent,
  exitCode = 0,
  worktreePath,
  vscodeInstance,
}: {
  taskRunId: Id<"taskRuns">;
  agent: AgentConfig;
  exitCode: number;
  worktreePath: string;
  vscodeInstance: VSCodeInstance;
}) {
  try {
    // Mark task as complete
    await convex.mutation(api.taskRuns.complete, {
      id: taskRunId,
      exitCode,
    });

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

    // Use the original captureGitDiff function which uses worker:exec
    const gitDiff = await captureGitDiff(vscodeInstance, worktreePath);
    serverLogger.info(
      `[AgentSpawner] Captured git diff for ${agent.name}: ${gitDiff.length} chars`
    );
    serverLogger.info(
      `[AgentSpawner] First 100 chars of diff: ${gitDiff.substring(0, 100)}`
    );

    // Append git diff to the log; diffs are fetched on-demand now
    if (gitDiff && gitDiff.length > 0) {
      await convex.mutation(api.taskRuns.appendLogPublic, {
        id: taskRunId,
        content: `\n\n=== GIT DIFF ===\n${gitDiff}\n=== END GIT DIFF ===\n`,
      });
      serverLogger.info(
        `[AgentSpawner] Successfully appended ${gitDiff.length} chars of git diff to log for ${taskRunId}`
      );
    } else {
      serverLogger.error(
        `[AgentSpawner] NO GIT DIFF TO APPEND for ${agent.name} (${taskRunId})`
      );
      serverLogger.error(
        `[AgentSpawner] This will cause crown evaluation to fail!`
      );
    }

    serverLogger.info(
      `[AgentSpawner] Updated taskRun ${taskRunId} as completed with exit code ${exitCode}`
    );

    // Check if all runs are complete and evaluate crown
    const taskRunData = await convex.query(api.taskRuns.get, {
      id: taskRunId,
    });

    serverLogger.info(
      `[AgentSpawner] Task run data retrieved: ${taskRunData ? "found" : "not found"}`
    );

    if (taskRunData) {
      serverLogger.info(
        `[AgentSpawner] Calling checkAndEvaluateCrown for task ${taskRunData.taskId}`
      );

      const winnerId = await convex.mutation(api.tasks.checkAndEvaluateCrown, {
        taskId: taskRunData.taskId,
      });

      serverLogger.info(
        `[AgentSpawner] checkAndEvaluateCrown returned: ${winnerId}`
      );

      // If winnerId is "pending", trigger Claude Code evaluation
      if (winnerId === "pending") {
        serverLogger.info(
          `[AgentSpawner] ==========================================`
        );
        serverLogger.info(
          `[AgentSpawner] CROWN EVALUATION NEEDED - TRIGGERING NOW`
        );
        serverLogger.info(`[AgentSpawner] Task ID: ${taskRunData.taskId}`);
        serverLogger.info(
          `[AgentSpawner] ==========================================`
        );

        // Trigger crown evaluation immediately for faster response
        // The periodic checker will also handle retries if this fails
        serverLogger.info(
          `[AgentSpawner] Triggering immediate crown evaluation`
        );

        // Small delay to ensure git diff is fully persisted in Convex
        setTimeout(async () => {
          try {
            // Crown evaluator is always disabled
            serverLogger.info(
              `[AgentSpawner] Crown evaluator disabled - skipping evaluation for task ${taskRunData.taskId}`
            );
            
            // The following code is commented out since crown evaluator is disabled
            // const task = await convex.query(api.tasks.getById, {
            //   id: taskRunData.taskId,
            // });
            // if (task?.crownEvaluationError === "in_progress") {
            //   serverLogger.info(
            //     `[AgentSpawner] Crown evaluation already in progress for task ${taskRunData.taskId}`
            //   );
            //   return;
            // }
            // await evaluateCrownWithClaudeCode(taskRunData.taskId);

            // Check if this task run won
            const updatedTaskRun = await convex.query(api.taskRuns.get, {
              id: taskRunId,
            });

            if (updatedTaskRun?.isCrowned) {
              serverLogger.info(
                `[AgentSpawner] 🏆 This task run won the crown! ${agent.name} is the winner!`
              );
            }
          } catch (error) {
            serverLogger.error(
              `[AgentSpawner] Crown evaluation failed:`,
              error
            );
            // The periodic checker will retry
          }
        }, 3000); // 3 second delay to ensure data persistence
      } else if (winnerId) {
        serverLogger.info(
          `[AgentSpawner] Task completed with winner: ${winnerId}`
        );

        // For single agent scenario, trigger auto-PR if enabled
        const taskRuns = await convex.query(api.taskRuns.getByTask, {
          taskId: taskRunData.taskId,
        });

        if (taskRuns.length === 1) {
          // Crown evaluator is always disabled
          serverLogger.info(
            `[AgentSpawner] Single agent scenario - crown evaluator disabled, skipping PR`
          );

          if (false && winnerId) {
            // This code is unreachable since crown evaluator is always disabled
            serverLogger.info(
              `[AgentSpawner] Triggering auto-PR for single agent completion`
            );

            const githubToken = await getGitHubTokenFromKeychain();

            // Small delay to ensure git diff is persisted
            setTimeout(async () => {
              try {
                await createPullRequestForWinner(
                  winnerId,
                  taskRunData.taskId,
                  githubToken || undefined
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
            }, 3000);
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

    // Enable auto-commit after task completion
    if (taskRunData) {
      const task = await convex.query(api.tasks.getById, {
        id: taskRunData.taskId,
      });

      if (task) {
        serverLogger.info(
          `[AgentSpawner] Performing auto-commit for ${agent.name}`
        );

        try {
          await performAutoCommitAndPush(
            vscodeInstance,
            agent,
            taskRunId,
            task.text
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
    }

    // Schedule container stop based on settings
    const containerSettings = await convex.query(
      api.containerSettings.getEffective
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

        await convex.mutation(api.taskRuns.updateScheduledStop, {
          id: taskRunId,
          scheduledStopAt,
        });

        serverLogger.info(
          `[AgentSpawner] Scheduled container stop for ${new Date(scheduledStopAt).toISOString()}`
        );
      }
    }
  } catch (error) {
    serverLogger.error(`[AgentSpawner] Error handling task completion:`, error);
  }
}
