import { existsSync } from "node:fs";
import { join } from "node:path";

import { log } from "../logger";
import { convexRequest } from "./convex";
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
import { createPullRequestIfEnabled } from "./pullRequest";
import {
  type CandidateData,
  type CrownEvaluationResponse,
  type CrownSummarizationResponse,
  type CrownWorkerCheckResponse,
  type WorkerAllRunsCompleteResponse,
  type WorkerRunContext,
  type WorkerTaskRunResponse,
} from "./types";
import { WORKSPACE_ROOT, sleep } from "./utils";

type WorkerCompletionOptions = {
  taskRunId: string;
  token: string;
  prompt: string;
  convexUrl?: string;
  agentModel?: string;
  teamId?: string;
  taskId?: string;
  elapsedMs?: number;
  exitCode?: number;
};

export async function handleWorkerTaskCompletion(
  options: WorkerCompletionOptions,
): Promise<void> {
  const {
    taskRunId,
    token,
    prompt,
    convexUrl,
    agentModel,
    teamId,
    taskId,
    elapsedMs,
    exitCode = 0,
  } = options;

  if (!token) {
    log("ERROR", "Missing worker token for task run completion", { taskRunId });
    return;
  }

  const detectedGitPath = await detectGitRepoPath();

  log("INFO", "Worker task completion handler started", {
    taskRunId,
    workspacePath: WORKSPACE_ROOT,
    gitRepoPath: detectedGitPath,
    envWorkspacePath: process.env.CMUX_WORKSPACE_PATH,
    agentModel,
    elapsedMs,
    exitCode,
    convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
  });

  const runContext: WorkerRunContext = {
    token,
    prompt,
    agentModel,
    teamId,
    taskId,
    convexUrl,
  };

  await sleep(2000);

  const baseUrlOverride = runContext.convexUrl;

  const info = await convexRequest<WorkerTaskRunResponse>(
    "/api/crown/check",
    runContext.token,
    {
      taskRunId,
      checkType: "info",
    },
    baseUrlOverride,
  );

  if (!info) {
    log(
      "ERROR",
      "Failed to load task run info - endpoint not found or network error",
      {
        taskRunId,
        info,
        convexUrl: baseUrlOverride || process.env.NEXT_PUBLIC_CONVEX_URL,
      },
    );
  } else if (!info.ok || !info.taskRun) {
    log("ERROR", "Task run info response invalid", {
      taskRunId,
      response: info,
      hasOk: info?.ok,
      hasTaskRun: info?.taskRun,
    });
    return;
  }

  const hasGitRepo = existsSync(join(detectedGitPath, ".git"));
  const hasProjectInfo = Boolean(info?.task?.projectFullName);
  const shouldPerformGitOps = hasProjectInfo && hasGitRepo;

  if (!shouldPerformGitOps) {
    log("INFO", "Skipping git operations", {
      taskRunId,
      hasProjectFullName: hasProjectInfo,
      hasGitRepo,
      gitPath: detectedGitPath,
      reason: !hasProjectInfo ? "environment-mode" : "no-git-repo",
    });
  } else {
    const promptForCommit =
      info?.task?.text ?? runContext.prompt ?? "cmux task";

    const diffForCommit = await captureRelevantDiff();
    log("INFO", "Captured relevant diff", {
      taskRunId,
      diffPreview: diffForCommit.slice(0, 120),
    });

    const commitMessage = buildCommitMessage({
      prompt: promptForCommit,
      agentName: agentModel ?? runContext.agentModel ?? "cmux-agent",
    });

    let branchForCommit = info?.taskRun?.newBranch;
    if (!branchForCommit) {
      branchForCommit = await getCurrentBranch();
      if (!branchForCommit) {
        const headCheck = await runGitCommandSafe(
          "git symbolic-ref -q HEAD",
          true,
        );
        if (!headCheck || headCheck.stdout.includes("fatal")) {
          log("WARN", "Git HEAD is detached or not properly initialized", {
            taskRunId,
            headStatus: headCheck?.stderr || "unknown",
          });
          if (info?.taskRun?.newBranch) {
            const createBranch = await runGitCommandSafe(
              `git checkout -b ${info.taskRun.newBranch}`,
              true,
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

    if (branchForCommit && info?.task?.projectFullName) {
      const remoteUrl = `https://github.com/${info.task.projectFullName}.git`;
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
          error,
        });
      }
    } else {
      log("ERROR", "Unable to resolve branch for auto-commit", {
        taskRunId,
        taskInfo: {
          hasTaskRun: Boolean(info?.taskRun),
          newBranch: info?.taskRun?.newBranch,
          hasTask: Boolean(info?.task),
          projectFullName: info?.task?.projectFullName,
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
    baseUrlOverride,
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

  // Always use the task ID from the task run (which is the real ID from the database)
  // Never use task IDs from other sources as they might be fake
  const realTaskId = completedRunInfo?.taskId;

  if (!realTaskId) {
    log("ERROR", "Missing real task ID from task run after worker completion", {
      taskRunId,
      hasCompletedRunInfo: Boolean(completedRunInfo),
      hasInfoTaskRun: Boolean(info?.taskRun),
    });
    return;
  }

  // Validate that it's not a fake ID (defensive check)
  if (realTaskId.startsWith("fake-")) {
    log("ERROR", "Task run has fake task ID - this should not happen", {
      taskRunId,
      taskId: realTaskId,
    });
    return;
  }

  runContext.taskId = realTaskId;
  runContext.teamId = completedRunInfo.teamId ?? runContext.teamId;

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
      baseUrlOverride,
    );

    const maxRetries = 3;
    let allComplete = false;
    let completionState: WorkerAllRunsCompleteResponse | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      completionState = await convexRequest<WorkerAllRunsCompleteResponse>(
        "/api/crown/check",
        runContext.token,
        {
          taskId: currentTaskId,
          checkType: "all-complete",
        },
        baseUrlOverride,
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
          (status) => status.status === "completed",
        ).length,
      });

      if (completionState.allComplete) {
        allComplete = true;
        break;
      }

      if (attempt < maxRetries - 1) {
        log("INFO", "Not all runs complete yet, waiting before retry", {
          taskRunId,
          attempt: attempt + 1,
          maxRetries,
        });
        await sleep(5000);
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
        },
      );
      return;
    }

    log("INFO", "All task runs complete; proceeding with crown evaluation", {
      taskRunId,
      taskId: currentTaskId,
    });

    const checkResponse = await convexRequest<CrownWorkerCheckResponse>(
      "/api/crown/check",
      runContext.token,
      {
        taskId: currentTaskId,
      },
      baseUrlOverride,
    );

    if (!checkResponse?.ok) {
      return;
    }

    if (!checkResponse.task) {
      log("ERROR", "Missing task in crown check response", {
        taskRunId,
        taskId: currentTaskId,
      });
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
            checkResponse.existingEvaluation.evaluatedAt,
          ).toISOString(),
        },
      );
      return;
    }

    const completedRuns = checkResponse.runs.filter(
      (run) => run.status === "completed",
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

      const singleRun = checkResponse.runs.find((run) => run.id === taskRunId);
      if (!singleRun) {
        log("ERROR", "Single-run entry missing during crown", { taskRunId });
        return;
      }

      const candidate = await (async () => {
        const gitDiff = await collectDiffForRun(
          baseBranch,
          singleRun.newBranch,
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
        } satisfies CandidateData;
      })();

      const branchesReady = await ensureBranchesAvailable(
        [{ id: candidate.runId, newBranch: candidate.newBranch }],
        baseBranch,
      );
      if (!branchesReady) {
        log("WARN", "Branches not ready for single-run crown; continuing", {
          taskRunId,
          elapsedMs,
        });
        return;
      }

      // For single run, skip evaluation and go straight to finalization
      log("INFO", "Single run detected, skipping evaluation", {
        taskRunId,
        runId: candidate.runId,
        agentName: candidate.agentName,
      });

      // Still get a summary for the PR description
      const summarizationResponse =
        await convexRequest<CrownSummarizationResponse>(
          "/api/crown/summarize",
          runContext.token,
          {
            prompt:
              checkResponse.task?.text || "Task description not available",
            gitDiff: candidate.gitDiff,
            teamSlugOrId: runContext.teamId,
          },
          baseUrlOverride,
        );

      const singleSummary = summarizationResponse?.summary
        ? summarizationResponse.summary.slice(0, 8000)
        : undefined;

      log("INFO", "Single-run summarization response", {
        taskRunId,
        summaryPreview: singleSummary?.slice(0, 120),
      });

      await convexRequest(
        "/api/crown/finalize",
        runContext.token,
        {
          taskId: checkResponse.taskId,
          winnerRunId: candidate.runId,
          reason: "Single run automatically selected (no competition)",
          evaluationPrompt: `Single run - no evaluation needed`,
          evaluationResponse: JSON.stringify({
            winner: 0,
            reason: "Single run - no competition",
          }),
          candidateRunIds: [candidate.runId],
          summary: singleSummary,
        },
        baseUrlOverride,
      );

      log("INFO", "Crowned task with single-run winner", {
        taskId: checkResponse.taskId,
        winnerRunId: candidate.runId,
        agentModel: agentModel ?? runContext.agentModel,
        elapsedMs,
      });
      return;
    }

    const completedRunsWithDiff = await Promise.all(
      completedRuns.map(async (run) => {
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
        } satisfies CandidateData;
      }),
    );

    const candidates = completedRunsWithDiff.filter(
      (candidate): candidate is CandidateData => Boolean(candidate),
    );

    if (candidates.length === 0) {
      log("ERROR", "No candidates available for crown evaluation", {
        taskRunId,
      });
      return;
    }

    if (!runContext.teamId) {
      log("ERROR", "Missing teamId for crown evaluation", { taskRunId });
      return;
    }

    if (!checkResponse.task?.text) {
      log("ERROR", "Missing task text for crown evaluation", {
        taskRunId,
        hasTask: !!checkResponse.task,
        hasText: !!checkResponse.task?.text,
      });
      return;
    }

    // Extract task text after validation for type safety
    const promptText = checkResponse.task.text;

    // Extra validation before making the request
    if (candidates.length === 0) {
      log(
        "ERROR",
        "No candidates available for crown evaluation after filtering",
        {
          taskRunId,
        },
      );
      return;
    }

    // Final validation before sending request
    if (
      !promptText ||
      typeof promptText !== "string" ||
      promptText.length === 0
    ) {
      log("ERROR", "Task text is invalid despite earlier checks", {
        taskRunId,
        promptType: typeof promptText,
        promptLength: promptText?.length,
      });
      return;
    }

    if (!Array.isArray(candidates) || candidates.length === 0) {
      log("ERROR", "Candidates array is invalid despite earlier checks", {
        taskRunId,
        candidatesType: typeof candidates,
        isArray: Array.isArray(candidates),
        candidatesLength: candidates?.length,
      });
      return;
    }

    if (!runContext.teamId || typeof runContext.teamId !== "string") {
      log("ERROR", "Team ID is invalid", {
        taskRunId,
        teamIdType: typeof runContext.teamId,
        teamId: runContext.teamId,
      });
      return;
    }

    log("INFO", "Preparing crown evaluation request", {
      taskRunId,
      hasPrompt: true,
      promptPreview: promptText.slice(0, 100),
      candidatesCount: candidates.length,
      teamId: runContext.teamId,
    });

    const requestBody = {
      prompt: promptText,
      candidates,
      teamSlugOrId: runContext.teamId,
    };

    // Log the exact request body being sent
    log("DEBUG", "Crown evaluation request body", {
      taskRunId,
      bodyKeys: Object.keys(requestBody),
      hasAllRequiredFields:
        !!requestBody.prompt &&
        !!requestBody.candidates &&
        !!requestBody.teamSlugOrId,
    });

    const evaluationResponse = await convexRequest<CrownEvaluationResponse>(
      "/api/crown/evaluate-agents",
      runContext.token,
      requestBody,
      baseUrlOverride,
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
      typeof evaluationResponse.winner === "number"
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

    const summaryResponse = await convexRequest<CrownSummarizationResponse>(
      "/api/crown/summarize",
      runContext.token,
      {
        prompt: promptText,
        gitDiff: winnerCandidate.gitDiff,
        teamSlugOrId: runContext.teamId,
      },
      baseUrlOverride,
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

    const reason = evaluationResponse.reason
      ? evaluationResponse.reason
      : `Selected ${winnerCandidate.agentName}`;

    await convexRequest(
      "/api/crown/finalize",
      runContext.token,
      {
        taskId: checkResponse.taskId,
        winnerRunId: winnerCandidate.runId,
        reason,
        evaluationPrompt: `Task: ${promptText}\nCandidates: ${JSON.stringify(candidates)}`,
        evaluationResponse: JSON.stringify(
          evaluationResponse ?? {
            winner: candidates.indexOf(winnerCandidate),
            reason,
            fallback: true,
          },
        ),
        candidateRunIds: candidates.map((candidate) => candidate.runId),
        summary,
        pullRequest: prMetadata?.pullRequest,
        pullRequestTitle: prMetadata?.title,
        pullRequestDescription: prMetadata?.description,
      },
      baseUrlOverride,
    );

    log("INFO", "Crowned task after evaluation", {
      taskId: checkResponse.taskId,
      winnerRunId: winnerCandidate.runId,
      winnerAgent: winnerCandidate.agentName,
      agentModel: agentModel ?? runContext.agentModel,
      elapsedMs,
    });
  }

  await attemptCrownEvaluation(realTaskId);
}
