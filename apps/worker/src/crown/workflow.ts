import { existsSync } from "node:fs";
import { join } from "node:path";

import { log } from "../logger";
import { WORKSPACE_ROOT } from "./constants";
import { convexRequest, scheduleContainerStop } from "./convex";
import {
  autoCommitAndPush,
  buildCommitMessage,
  cacheBranchDiff,
  captureRelevantDiff,
  collectDiffForRun,
  detectGitRepoPath,
  ensureBranchesAvailable,
  getCurrentBranch,
  runGitCommandSafe,
} from "./git";
import { createPullRequestIfEnabled } from "./pull-request";
import { buildEvaluationPrompt, buildSummarizationPrompt } from "./prompts";
import type {
  CandidateData,
  CrownEvaluationResponse,
  CrownSummarizationResponse,
  CrownWorkerCheckResponse,
  WorkerAllRunsCompleteResponse,
  WorkerRunContext,
  WorkerTaskRunResponse,
} from "./types";
import { sleep } from "./utils";

export type { WorkerRunContext } from "./types";


export async function handleWorkerTaskCompletion(
  taskRunId: string,
  runContext: WorkerRunContext,
  opts: { agentModel?: string; elapsedMs?: number; exitCode?: number }
): Promise<void> {
  const { agentModel, elapsedMs, exitCode = 0 } = opts;

  // Detect git repo path early to log it
  const detectedGitPath = await detectGitRepoPath();

  log("INFO", "Worker task completion handler started", {
    taskRunId,
    workspacePath: WORKSPACE_ROOT,
    gitRepoPath: detectedGitPath,
    envWorkspacePath: process.env.CMUX_WORKSPACE_PATH,
    agentModel,
    elapsedMs,
    exitCode,
    convexUrl: runContext.convexUrl ?? process.env.NEXT_PUBLIC_CONVEX_URL,
  });

  await sleep(2000);

  const baseUrlOverride = runContext.convexUrl;

  try {
    // Use the crown endpoint with checkType="info" to get task run info
    const info = await convexRequest<WorkerTaskRunResponse>(
      "/api/crown/check",
      runContext.token,
      {
        taskRunId,
        checkType: "info",
      },
      baseUrlOverride
    );

    if (!info) {
      log(
        "ERROR",
        "Failed to load task run info - endpoint not found or network error",
        {
          taskRunId,
          info,
          convexUrl: baseUrlOverride || process.env.NEXT_PUBLIC_CONVEX_URL,
        }
      );
      // Try to continue with minimal context
    } else if (!info.ok || !info.taskRun) {
      log("ERROR", "Task run info response invalid", {
        taskRunId,
        response: info,
        hasOk: info?.ok,
        hasTaskRun: info?.taskRun,
      });
      return;
    }

    if (info?.taskRun) {
      runContext.taskId = runContext.taskId ?? info.taskRun.taskId;
      runContext.teamId = runContext.teamId ?? info.taskRun.teamId;
    }

    // Check if we should perform git operations
    // Skip if: 1) No git repo detected, or 2) neither projectFullName nor origin remote available
    const hasGitRepo = existsSync(join(detectedGitPath, ".git"));
    const hasProjectInfo = !!info?.task?.projectFullName;
    const gitRemoteCheck = hasGitRepo
      ? await runGitCommandSafe("git remote get-url origin", true)
      : null;
    const remoteOriginUrl = gitRemoteCheck?.stdout.trim() ?? "";
    const hasRemoteOrigin = Boolean(remoteOriginUrl);
    const shouldPerformGitOps = hasGitRepo && (hasProjectInfo || hasRemoteOrigin);

    if (!shouldPerformGitOps) {
      log("INFO", "Skipping git operations", {
        taskRunId,
        hasProjectFullName: hasProjectInfo,
        hasGitRepo,
        gitPath: detectedGitPath,
        hasRemoteOrigin,
        reason: !hasGitRepo
          ? "no-git-repo"
          : hasProjectInfo
          ? "missing-remote"
          : "insufficient-repo-context",
      });
    } else {
      // Only perform git operations if we have a repository
      const taskTextForCommit =
        info?.task?.text ?? runContext.prompt ?? "cmux task";

      const diffForCommit = await captureRelevantDiff();
      log("INFO", "Captured relevant diff", {
        taskRunId,
        diffPreview: diffForCommit.slice(0, 120),
      });

      const commitMessage = buildCommitMessage({
        taskText: taskTextForCommit,
        agentName: agentModel ?? runContext.agentModel ?? "cmux-agent",
      });

      // Try to get branch from task run info first, fall back to git command
      let branchForCommit = info?.taskRun?.newBranch;
      if (!branchForCommit) {
        branchForCommit = await getCurrentBranch();
        if (!branchForCommit) {
          // Last resort: if we can't detect the branch, check if we're in a detached HEAD state
          // This can happen in cloud mode if the git setup is incomplete
          const headCheck = await runGitCommandSafe(
            "git symbolic-ref -q HEAD",
            true
          );
          if (!headCheck || headCheck.stdout.includes("fatal")) {
            log("WARN", "Git HEAD is detached or not properly initialized", {
              taskRunId,
              headStatus: headCheck?.stderr || "unknown",
            });
            // Try to get the branch name from environment or task context
            if (info?.taskRun?.newBranch) {
              // Create the branch if we have the name
              const createBranch = await runGitCommandSafe(
                `git checkout -b ${info.taskRun.newBranch}`,
                true
              );
              if (createBranch && createBranch.stdout) {
                branchForCommit = info.taskRun.newBranch;
                log("INFO", "Created branch from task run info", {
                  branch: branchForCommit,
                  taskRunId,
                });
              }
            }
          }
        }
      }

      if (branchForCommit) {
        cacheBranchDiff(branchForCommit, diffForCommit);
        log("INFO", "Cached diff for branch after auto-commit", {
          branch: branchForCommit,
          diffLength: diffForCommit.length,
        });
      }

      if (branchForCommit) {
        const remoteUrl = info?.task?.projectFullName
          ? `https://github.com/${info.task.projectFullName}.git`
          : undefined;
        try {
          await autoCommitAndPush({
            branchName: branchForCommit,
            commitMessage,
            remoteUrl,
          });
        } catch (error) {
          log("ERROR", "Worker auto-commit failed", {
            taskRunId,
            branch: branchForCommit,
            hasProjectInfo,
            hasRemoteOrigin,
            remoteOriginUrl,
            remoteUrl,
            error,
          });
        }
      } else {
        log("ERROR", "Unable to resolve branch for auto-commit", {
          taskRunId,
          taskInfo: {
            hasTaskRun: !!info?.taskRun,
            newBranch: info?.taskRun?.newBranch,
            hasTask: !!info?.task,
            projectFullName: info?.task?.projectFullName,
          },
          gitContext: {
            hasGitRepo,
            hasRemoteOrigin,
            remoteOriginUrl,
          },
        });
      }
    }

    const completion = await convexRequest<WorkerTaskRunResponse>(
      "/api/crown/complete",
      runContext.token,
      {
        taskRunId,
        exitCode,
      },
      baseUrlOverride
    );

    if (!completion?.ok) {
      log("ERROR", "Worker completion request failed", { taskRunId });
      return;
    }

    log("INFO", "Worker marked as complete, preparing for crown check", {
      taskRunId,
      taskId: runContext.taskId,
    });

    const completedRunInfo = completion.taskRun ?? info?.taskRun;
    if (completedRunInfo) {
      runContext.taskId = completedRunInfo.taskId;
      runContext.teamId = runContext.teamId ?? completedRunInfo.teamId;
    }

    const taskId = runContext.taskId ?? completion.task?.id ?? info?.task?.id;
    if (!taskId) {
      log("ERROR", "Missing task ID after worker completion", { taskRunId });
      return;
    }
    runContext.taskId = taskId;

    const containerSettings =
      completion.containerSettings ?? info?.containerSettings;

    if (containerSettings?.autoCleanupEnabled) {
      const reviewMinutes = containerSettings.reviewPeriodMinutes ?? 60;
      const stopAt = containerSettings.stopImmediatelyOnCompletion
        ? Date.now()
        : Date.now() + reviewMinutes * 60 * 1000;
      await scheduleContainerStop(
        runContext.token,
        taskRunId,
        stopAt,
        baseUrlOverride
      );
    }

    async function attemptCrownEvaluation(currentTaskId: string) {
      log("INFO", "Starting crown evaluation attempt", {
        taskRunId,
        taskId: currentTaskId,
      });

      await convexRequest(
        "/api/crown/status",
        runContext.token,
        {
          taskRunId,
          status: "complete",
        },
        baseUrlOverride
      );

      // Retry logic for checking all-complete status
      const maxRetries = 3;
      let allComplete = false;
      let completionState: WorkerAllRunsCompleteResponse | null = null;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        // Use the crown endpoint with checkType="all-complete" to check all runs
        completionState = await convexRequest<WorkerAllRunsCompleteResponse>(
          "/api/crown/check",
          runContext.token,
          {
            taskId: currentTaskId,
            checkType: "all-complete",
          },
          baseUrlOverride
        );

        if (!completionState?.ok) {
          log("ERROR", "Failed to verify task run completion state", {
            taskRunId,
            taskId: currentTaskId,
            attempt,
          });
          return;
        }

        log("INFO", "Task completion state check", {
          taskRunId,
          taskId: currentTaskId,
          attempt,
          allComplete: completionState.allComplete,
          totalStatuses: completionState.statuses.length,
          completedCount: completionState.statuses.filter(
            (s) => s.status === "completed"
          ).length,
        });

        if (completionState.allComplete) {
          allComplete = true;
          break;
        }

        // If not all complete and we have more attempts, wait before retrying
        if (attempt < maxRetries - 1) {
          log("INFO", "Not all runs complete yet, waiting before retry", {
            taskRunId,
            attempt: attempt + 1,
            maxRetries,
          });
          await sleep(5000); // Wait 5 seconds before retrying
        }
      }

      if (!allComplete || !completionState) {
        log(
          "INFO",
          "Task runs still pending after retries; deferring crown evaluation",
          {
            taskRunId,
            taskId: currentTaskId,
            statuses: completionState?.statuses || [],
          }
        );
        return;
      }

      log("INFO", "All task runs complete; proceeding with crown evaluation", {
        taskRunId,
        taskId: currentTaskId,
      });

      // Check if evaluation already exists before proceeding
      const checkResponse = await convexRequest<CrownWorkerCheckResponse>(
        "/api/crown/check",
        runContext.token,
        {
          taskId: currentTaskId,
        },
        baseUrlOverride
      );

      if (!checkResponse?.ok) {
        return;
      }

      if (checkResponse.existingEvaluation) {
        log(
          "INFO",
          "Crown evaluation already exists (another worker completed it)",
          {
            taskRunId,
            winnerRunId: checkResponse.existingEvaluation.winnerRunId,
            evaluatedAt: new Date(
              checkResponse.existingEvaluation.evaluatedAt
            ).toISOString(),
          }
        );
        return;
      }

      const completedRuns = checkResponse.runs.filter(
        (run) => run.status === "completed"
      );
      const totalRuns = checkResponse.runs.length;
      const allRunsCompleted =
        totalRuns > 0 && completedRuns.length === totalRuns;

      log("INFO", "Crown readiness status", {
        taskRunId,
        taskId: currentTaskId,
        totalRuns,
        completedRuns: completedRuns.length,
        allRunsCompleted,
      });

      if (!allRunsCompleted) {
        log("INFO", "Not all task runs completed; deferring crown evaluation", {
          taskRunId,
          taskId: currentTaskId,
          runStatuses: checkResponse.runs.map((run) => ({
            id: run.id,
            status: run.status,
          })),
        });
        return;
      }

      const baseBranch = checkResponse.task.baseBranch ?? "main";

      if (checkResponse.singleRunWinnerId) {
        if (checkResponse.singleRunWinnerId !== taskRunId) {
          log("INFO", "Single-run winner already handled by another run", {
            taskRunId,
            winnerRunId: checkResponse.singleRunWinnerId,
          });
          return;
        }

        const singleRun = checkResponse.runs.find(
          (run) => run.id === taskRunId
        );
        if (!singleRun) {
          log("ERROR", "Single-run entry missing during crown", { taskRunId });
          return;
        }

        const candidate = await (async () => {
          const gitDiff = await collectDiffForRun(
            baseBranch,
            singleRun.newBranch
          );
          log("INFO", "Built crown candidate", {
            runId: singleRun.id,
            branch: singleRun.newBranch,
            gitDiffPreview: gitDiff.slice(0, 120),
          });
          return {
            runId: singleRun.id,
            agentName: singleRun.agentName ?? "unknown agent",
            gitDiff,
            newBranch: singleRun.newBranch,
            status: singleRun.status,
            exitCode: singleRun.exitCode ?? null,
          } satisfies CandidateData;
        })();

        const branchesReady = await ensureBranchesAvailable(
          [{ id: candidate.runId, newBranch: candidate.newBranch }],
          baseBranch
        );
        if (!branchesReady) {
          log("WARN", "Branches not ready for single-run crown; continuing", {
            taskRunId,
          });
        }

        if (!runContext.teamId) {
          log("ERROR", "Missing teamId for single-run crown", {
            taskRunId,
          });
          return;
        }

        const evaluationPrompt = buildEvaluationPrompt(
          checkResponse.task.text,
          [candidate]
        );
        const summarizationPrompt = buildSummarizationPrompt(
          checkResponse.task.text,
          candidate.gitDiff
        );

        const summaryResponse = await convexRequest<CrownSummarizationResponse>(
          "/api/crown/summarize",
          runContext.token,
          {
            prompt: summarizationPrompt,
            teamSlugOrId: runContext.teamId,
          },
          baseUrlOverride
        );

        const summary = summaryResponse?.summary
          ? summaryResponse.summary.slice(0, 8000)
          : undefined;

        const prMetadata = await createPullRequestIfEnabled({
          check: checkResponse,
          winner: candidate,
          summary,
          context: runContext,
        });

        await convexRequest(
          "/api/crown/finalize",
          runContext.token,
          {
            taskId: checkResponse.taskId,
            winnerRunId: taskRunId,
            reason: "Only one run completed; crowned by default",
            evaluationPrompt,
            evaluationResponse: JSON.stringify({
              winner: 0,
              reason: "Only candidate run",
            }),
            candidateRunIds: [taskRunId],
            summary,
            pullRequest: prMetadata?.pullRequest,
            pullRequestTitle: prMetadata?.title,
            pullRequestDescription: prMetadata?.description,
          },
          baseUrlOverride
        );

        log("INFO", "Crowned single-run task", {
          taskId: checkResponse.taskId,
          taskRunId,
          agentModel: agentModel ?? runContext.agentModel,
          elapsedMs,
        });
        return;
      }

      if (completedRuns.length < 2) {
        log("INFO", "Not enough completed runs for crown", {
          taskRunId,
          completedRuns: completedRuns.length,
        });
        return;
      }

      const branchesReady = await ensureBranchesAvailable(
        completedRuns.map((run) => ({ id: run.id, newBranch: run.newBranch })),
        baseBranch
      );
      if (!branchesReady) {
        log("ERROR", "Branches not ready for multi-run crown", {
          taskRunId,
        });
        return;
      }

      const buildCandidate = async (
        run: CrownWorkerCheckResponse["runs"][number]
      ): Promise<CandidateData | null> => {
        if (!run) {
          return null;
        }
        const gitDiff = await collectDiffForRun(baseBranch, run.newBranch);
        log("INFO", "Built crown candidate", {
          runId: run.id,
          branch: run.newBranch,
          gitDiffPreview: gitDiff.slice(0, 120),
        });
        return {
          runId: run.id,
          agentName: run.agentName ?? "unknown agent",
          gitDiff,
          newBranch: run.newBranch,
          status: run.status,
          exitCode: run.exitCode ?? null,
        };
      };

      const candidates: CandidateData[] = [];
      for (const run of completedRuns) {
        const candidate = await buildCandidate(run);
        if (!candidate) {
          log("ERROR", "Failed to build crown candidate", {
            taskRunId,
            runId: run.id,
          });
          return;
        }
        candidates.push(candidate);
      }

      if (!runContext.teamId) {
        log("ERROR", "Missing teamId for crown evaluation", { taskRunId });
        return;
      }

      const evaluationPrompt = buildEvaluationPrompt(
        checkResponse.task.text,
        candidates
      );

      const evaluationResponse = await convexRequest<CrownEvaluationResponse>(
        "/api/crown/evaluate",
        runContext.token,
        {
          prompt: evaluationPrompt,
          teamSlugOrId: runContext.teamId,
        },
        baseUrlOverride
      );

      if (!evaluationResponse) {
        log("ERROR", "Crown evaluation response missing", {
          taskRunId,
        });
        return;
      }

      log("INFO", "Crown evaluation response", {
        taskRunId,
        winner: evaluationResponse.winner,
        reason: evaluationResponse.reason,
      });

      const winnerIndex =
        typeof evaluationResponse?.winner === "number"
          ? evaluationResponse.winner
          : 0;
      const winnerCandidate = candidates[winnerIndex] ?? candidates[0];
      if (!winnerCandidate) {
        log("ERROR", "Unable to determine crown winner", {
          taskRunId,
          winnerIndex,
        });
        return;
      }

      const summarizationPrompt = buildSummarizationPrompt(
        checkResponse.task.text,
        winnerCandidate.gitDiff
      );
      const summaryResponse = await convexRequest<CrownSummarizationResponse>(
        "/api/crown/summarize",
        runContext.token,
        {
          prompt: summarizationPrompt,
          teamSlugOrId: runContext.teamId,
        },
        baseUrlOverride
      );

      log("INFO", "Crown summarization response", {
        taskRunId,
        summaryPreview: summaryResponse?.summary?.slice(0, 120),
      });

      const summary = summaryResponse?.summary
        ? summaryResponse.summary.slice(0, 8000)
        : undefined;

      const prMetadata = await createPullRequestIfEnabled({
        check: checkResponse,
        winner: winnerCandidate,
        summary,
        context: runContext,
      });

      const reason = evaluationResponse?.reason
        ? evaluationResponse.reason
        : `Selected ${winnerCandidate.agentName}`;

      await convexRequest(
        "/api/crown/finalize",
        runContext.token,
        {
          taskId: checkResponse.taskId,
          winnerRunId: winnerCandidate.runId,
          reason,
          evaluationPrompt,
          evaluationResponse: JSON.stringify(
            evaluationResponse ?? {
              winner: candidates.indexOf(winnerCandidate),
              reason,
              fallback: true,
            }
          ),
          candidateRunIds: candidates.map((candidate) => candidate.runId),
          summary,
          pullRequest: prMetadata?.pullRequest,
          pullRequestTitle: prMetadata?.title,
          pullRequestDescription: prMetadata?.description,
        },
        baseUrlOverride
      );

      log("INFO", "Crowned task after evaluation", {
        taskId: checkResponse.taskId,
        winnerRunId: winnerCandidate.runId,
        winnerAgent: winnerCandidate.agentName,
        agentModel: agentModel ?? runContext.agentModel,
        elapsedMs,
      });
    }

    await attemptCrownEvaluation(taskId);
  } finally {
    // Nothing to cleanup here; caller is responsible for lifecycle management.
  }
}
