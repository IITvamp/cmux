import { Buffer } from "node:buffer";
import { exec as childExec } from "node:child_process";
import { promisify } from "node:util";

import { log } from "../logger.js";

const execAsync = promisify(childExec);

const WORKSPACE_ROOT = process.env.CMUX_WORKSPACE_PATH || "/root/workspace";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type WorkerRunContext = {
  token: string;
  prompt: string;
  agentModel?: string;
  teamId?: string;
  taskId?: string;
  convexUrl?: string;
};

type CrownWorkerCheckResponse = {
  ok: true;
  taskId: string;
  allRunsFinished: boolean;
  allWorkersReported: boolean;
  shouldEvaluate: boolean;
  singleRunWinnerId: string | null;
  existingEvaluation: null | {
    winnerRunId: string;
    evaluatedAt: number;
  };
  task: {
    text: string;
    crownEvaluationError: string | null;
    isCompleted: boolean;
    baseBranch: string | null;
    projectFullName: string | null;
    autoPrEnabled: boolean;
  };
  runs: Array<{
    id: string;
    status: "pending" | "running" | "completed" | "failed";
    workerStatus: "pending" | "complete";
    agentName: string | null;
    newBranch: string | null;
    exitCode: number | null;
    completedAt: number | null;
  }>;
};

type WorkerTaskRunDescriptor = {
  id: string;
  taskId: string;
  teamId: string;
  newBranch: string | null;
  agentName: string | null;
};

type WorkerTaskRunResponse = {
  ok: boolean;
  taskRun: WorkerTaskRunDescriptor | null;
  task: { id: string; text: string } | null;
  containerSettings: {
    autoCleanupEnabled: boolean;
    stopImmediatelyOnCompletion: boolean;
    reviewPeriodMinutes: number;
  } | null;
};

type WorkerAllRunsCompleteResponse = {
  ok: boolean;
  taskId: string;
  allComplete: boolean;
  statuses: Array<{ id: string; status: string; workerStatus?: string }>;
};

const taskRunContexts = new Map<string, WorkerRunContext>();

function getConvexBaseUrl(override?: string): string | null {
  const url = override ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    log(
      "ERROR",
      "NEXT_PUBLIC_CONVEX_URL is not configured; cannot call crown endpoints"
    );
    return null;
  }
  return url.replace(/\/$/, "");
}

async function convexRequest<T>(
  path: string,
  token: string,
  body: Record<string, unknown>,
  baseUrlOverride?: string
): Promise<T | null> {
  const baseUrl = getConvexBaseUrl(baseUrlOverride);
  if (!baseUrl) return null;

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-cmux-token": token,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "<no body>");
      log("ERROR", `Crown request failed (${response.status})`, {
        path,
        body,
        errorText,
      });
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    log("ERROR", "Failed to reach crown endpoint", { path, error });
    return null;
  }
}

async function runGitCommand(
  command: string
): Promise<{ stdout: string } | null> {
  try {
    const result = await execAsync(command, {
      cwd: WORKSPACE_ROOT,
      maxBuffer: 20 * 1024 * 1024,
    });
    const stdoutValue = result.stdout as unknown;
    const stdout =
      typeof stdoutValue === "string"
        ? stdoutValue
        : Buffer.isBuffer(stdoutValue)
          ? stdoutValue.toString("utf8")
          : String(stdoutValue ?? "");
    return { stdout };
  } catch (error) {
    log("ERROR", "Git command failed", { command, error });
    return null;
  }
}

async function fetchRemoteRef(ref: string): Promise<boolean> {
  if (!ref) return false;
  const attempts = 5;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await runGitCommand(
      `git fetch --no-tags --prune origin ${ref}`
    );
    if (result) {
      return true;
    }
    await sleep(1000);
  }
  return false;
}

function truncateDiff(diff: string): string {
  if (!diff) return "No changes detected";
  const trimmed = diff.trim();
  if (trimmed.length === 0) return "No changes detected";
  const limit = 5000;
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit)}\n... (truncated)`;
}

async function collectDiffForRun(
  baseBranch: string,
  branch: string | null
): Promise<string> {
  if (!branch) {
    return "No changes detected";
  }

  const sanitizedBase = baseBranch || "main";
  try {
    const baseFetched = await fetchRemoteRef(sanitizedBase);
    const branchFetched = await fetchRemoteRef(branch);
    if (!baseFetched) {
      log("WARNING", "Failed to fetch base branch; continuing", {
        baseBranch: sanitizedBase,
      });
    }
    const baseRef = `origin/${sanitizedBase}`;
    const diffCommand = branchFetched
      ? `git diff ${baseRef}..origin/${branch}`
      : `git diff ${baseRef}`;
    const diffResult = await runGitCommand(diffCommand);
    if (!diffResult) {
      return "No changes detected";
    }
    return truncateDiff(diffResult.stdout);
  } catch (error) {
    log("ERROR", "Failed to collect diff for run", {
      baseBranch: sanitizedBase,
      branch,
      error,
    });
    return "No changes detected";
  }
}

async function ensureBranchesAvailable(
  completedRuns: Array<{ id: string; newBranch: string | null }>,
  baseBranch: string,
  maxAttempts = 10,
  localFallbackBranches: Set<string> = new Set()
): Promise<boolean> {
  const sanitizedBase = baseBranch || "main";
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const baseOk = await fetchRemoteRef(sanitizedBase);
    log("INFO", "Ensuring branches available", {
      attempt,
      maxAttempts,
      baseBranch: sanitizedBase,
      baseOk,
      completedRunCount: completedRuns.length,
    });
    let allBranchesOk = true;
    for (const run of completedRuns) {
      if (!run.newBranch) {
        log("ERROR", "Run missing branch name", { runId: run.id });
        return false;
      }
      const branchOk = await fetchRemoteRef(run.newBranch);
      log("INFO", "Checked branch availability", {
        runId: run.id,
        branch: run.newBranch,
        branchOk,
      });
      if (!branchOk && !localFallbackBranches.has(run.newBranch)) {
        allBranchesOk = false;
      }
    }
    if (baseOk && allBranchesOk) {
      return true;
    }
    log("INFO", "Branch check failed; retrying", {
      attempt,
      baseOk,
      allBranchesOk,
    });
    await sleep(3000);
  }
  return false;
}

type CandidateData = {
  runId: string;
  agentName: string;
  gitDiff: string;
  newBranch: string | null;
};

async function captureRelevantDiff(): Promise<string> {
  try {
    const { stdout } = await execAsync(
      "/usr/local/bin/cmux-collect-relevant-diff.sh",
      {
        cwd: WORKSPACE_ROOT,
        maxBuffer: 5 * 1024 * 1024,
      }
    );
    const diff = stdout ? stdout.trim() : "";
    return diff.length > 0 ? diff : "No changes detected";
  } catch (error) {
    log("ERROR", "Failed to collect relevant diff", { error });
    return "No changes detected";
  }
}

function buildCommitMessage({
  taskText,
  agentName,
}: {
  taskText: string;
  agentName: string;
}): string {
  const baseLine = taskText.trim().split("\n")[0] ?? "task";
  const subject =
    baseLine.length > 60 ? `${baseLine.slice(0, 57)}...` : baseLine;
  const sanitizedAgent = agentName.replace(/[^a-zA-Z0-9_-]/g, "-");
  return `chore(${sanitizedAgent}): ${subject}`;
}

async function runGitCommandSafe(
  command: string,
  allowFailure = false
): Promise<{ stdout: string; stderr: string } | null> {
  try {
    const result = await execAsync(command, {
      cwd: WORKSPACE_ROOT,
      maxBuffer: 10 * 1024 * 1024,
    });
    const stdoutValue = result.stdout as unknown;
    const stderrValue = result.stderr as unknown;
    const stdout =
      typeof stdoutValue === "string"
        ? stdoutValue
        : Buffer.isBuffer(stdoutValue)
          ? stdoutValue.toString("utf8")
          : String(stdoutValue ?? "");
    const stderr =
      typeof stderrValue === "string"
        ? stderrValue
        : Buffer.isBuffer(stderrValue)
          ? stderrValue.toString("utf8")
          : String(stderrValue ?? "");
    return { stdout, stderr };
  } catch (error) {
    if (!allowFailure) {
      log("ERROR", "Git command failed", { command, error });
      throw error;
    }
    log("WARN", "Git command failed (ignored)", { command, error });
    return null;
  }
}

async function getCurrentBranch(): Promise<string | null> {
  const result = await runGitCommandSafe(
    "git rev-parse --abbrev-ref HEAD",
    true
  );
  const branch = result?.stdout.trim();
  if (!branch) {
    log("WARN", "Unable to determine current git branch");
    return null;
  }
  return branch;
}

async function autoCommitAndPush({
  branchName,
  commitMessage,
}: {
  branchName: string;
  commitMessage: string;
}): Promise<void> {
  if (!branchName) {
    log("ERROR", "Missing branch name for auto-commit");
    return;
  }

  log("INFO", "Worker auto-commit starting", { branchName });

  await runGitCommandSafe(`git add -A`);

  await runGitCommandSafe(`git checkout -B ${branchName}`);

  const status = await runGitCommandSafe(`git status --short`, true);
  const hasChanges = !!status?.stdout.trim();

  if (hasChanges) {
    await runGitCommandSafe(
      `git commit -m ${JSON.stringify(commitMessage)}`,
      true
    );
  } else {
    log("INFO", "No changes detected before commit", { branchName });
  }

  const remoteExists = await runGitCommandSafe(
    `git ls-remote --heads origin ${branchName}`,
    true
  );

  if (remoteExists?.stdout.trim()) {
    await runGitCommandSafe(`git pull --rebase origin ${branchName}`, true);
  }

  await runGitCommandSafe(`git push -u origin ${branchName}`, true);

  log("INFO", "Worker auto-commit finished", { branchName });
}

async function scheduleContainerStop(
  token: string,
  taskRunId: string,
  scheduledStopAt?: number,
  baseUrlOverride?: string
): Promise<void> {
  await convexRequest(
    `/api/crown/schedule-stop`,
    token,
    {
      taskRunId,
      scheduledStopAt,
    },
    baseUrlOverride
  );
}

function buildEvaluationPrompt(
  taskText: string,
  candidates: CandidateData[]
): string {
  const evaluationData = {
    task: taskText,
    implementations: candidates.map((candidate, index) => ({
      modelName: candidate.agentName,
      gitDiff: candidate.gitDiff,
      index,
    })),
  };

  return `You are evaluating code implementations from different AI models.\n\nHere are the implementations to evaluate:\n${JSON.stringify(
    evaluationData,
    null,
    2
  )}\n\nNOTE: The git diffs shown contain only actual code changes. Lock files, build artifacts, and other non-essential files have been filtered out.\n\nAnalyze these implementations and select the best one based on:\n1. Code quality and correctness\n2. Completeness of the solution\n3. Following best practices\n4. Actually having meaningful code changes (if one has no changes, prefer the one with changes)\n\nRespond with a JSON object containing:\n- "winner": the index (0-based) of the best implementation\n- "reason": a brief explanation of why this implementation was chosen\n\nExample response:\n{"winner": 0, "reason": "Model claude/sonnet-4 provided a more complete implementation with better error handling and cleaner code structure."}\n\nIMPORTANT: Respond ONLY with the JSON object, no other text.`;
}

function buildSummarizationPrompt(taskText: string, gitDiff: string): string {
  return `You are an expert reviewer summarizing a pull request.\n\nGOAL\n- Explain succinctly what changed and why.\n- Call out areas the user should review carefully.\n- Provide a quick test plan to validate the changes.\n\nCONTEXT\n- User's original request:\n${taskText}\n- Relevant diffs (unified):\n${gitDiff || "<no code changes captured>"}\n\nINSTRUCTIONS\n- Base your summary strictly on the provided diffs and request.\n- Be specific about files and functions when possible.\n- Prefer clear bullet points over prose. Keep it under ~300 words.\n- If there are no code changes, say so explicitly and suggest next steps.\n\nOUTPUT FORMAT (Markdown)\n## PR Review Summary\n- What Changed: bullet list\n- Review Focus: bullet list (risks/edge cases)\n- Test Plan: bullet list of practical steps\n- Follow-ups: optional bullets if applicable\n`;
}

type CrownEvaluationResponse = {
  winner: number;
  reason: string;
};

type CrownSummarizationResponse = {
  summary: string;
};

type PullRequestMetadata = {
  pullRequest?: {
    url: string;
    isDraft?: boolean;
    state?: "none" | "draft" | "open" | "merged" | "closed" | "unknown";
    number?: number;
  };
  title?: string;
  description?: string;
};

function buildPullRequestTitle(taskText: string): string {
  const base = taskText.trim() || "cmux changes";
  const title = `[Crown] ${base}`;
  return title.length > 72 ? `${title.slice(0, 69)}...` : title;
}

function buildPullRequestBody({
  summary,
  taskText,
  agentName,
  branch,
  taskId,
  runId,
}: {
  summary?: string;
  taskText: string;
  agentName: string;
  branch: string;
  taskId: string;
  runId: string;
}): string {
  const bodySummary = summary?.trim() || "Summary not available.";
  return `## 🏆 Crown Winner: ${agentName}

### Task Description
${taskText}

### Summary
${bodySummary}

### Implementation Details
- **Agent**: ${agentName}
- **Task ID**: ${taskId}
- **Run ID**: ${runId}
- **Branch**: ${branch}
- **Created**: ${new Date().toISOString()}`;
}

function mapGhState(
  state: string | undefined
): "none" | "draft" | "open" | "merged" | "closed" | "unknown" {
  if (!state) return "unknown";
  const normalized = state.toLowerCase();
  if (
    normalized === "open" ||
    normalized === "closed" ||
    normalized === "merged"
  ) {
    return normalized as "open" | "closed" | "merged";
  }
  return "unknown";
}

async function createPullRequestIfEnabled(options: {
  check: CrownWorkerCheckResponse;
  winner: CandidateData;
  summary?: string;
  context: WorkerRunContext;
}): Promise<PullRequestMetadata | null> {
  const { check, winner, summary, context } = options;
  if (!check.task.autoPrEnabled) {
    return null;
  }

  const branch = winner.newBranch;
  if (!branch) {
    log("WARNING", "Skipping PR creation - winner branch missing", {
      taskId: check.taskId,
      runId: winner.runId,
    });
    return null;
  }

  const baseBranch = check.task.baseBranch || "main";
  const prTitle = buildPullRequestTitle(check.task.text);
  const prBody = buildPullRequestBody({
    summary,
    taskText: check.task.text,
    agentName: winner.agentName,
    branch,
    taskId: context.taskId ?? check.taskId,
    runId: winner.runId,
  });

  const script = `set -e
BODY_FILE=$(mktemp /tmp/cmux-pr-XXXXXX.md)
cat <<'CMUX_EOF' > "$BODY_FILE"
${prBody}
CMUX_EOF
gh pr create --base "$PR_BASE" --head "$PR_HEAD" --title "$PR_TITLE" --body-file "$BODY_FILE" --json url,number,state,isDraft
rm -f "$BODY_FILE"
`;

  try {
    const { stdout } = await execAsync(script, {
      cwd: WORKSPACE_ROOT,
      env: {
        ...process.env,
        PR_TITLE: prTitle,
        PR_BASE: baseBranch,
        PR_HEAD: branch,
      },
      maxBuffer: 5 * 1024 * 1024,
    });

    const trimmed = stdout.trim();
    if (!trimmed) {
      log("ERROR", "gh pr create returned empty output", {
        taskId: check.taskId,
        runId: winner.runId,
      });
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      log("ERROR", "Failed to parse gh pr create output", {
        stdout: trimmed,
        error,
      });
      return null;
    }

    const prUrl = typeof parsed.url === "string" ? parsed.url : undefined;
    if (!prUrl) {
      log("ERROR", "gh pr create response missing URL", { parsed });
      return null;
    }

    const prNumber = (() => {
      if (typeof parsed.number === "number") return parsed.number;
      if (typeof parsed.number === "string") {
        const numeric = Number(parsed.number);
        return Number.isFinite(numeric) ? numeric : undefined;
      }
      return undefined;
    })();

    const metadata: PullRequestMetadata = {
      pullRequest: {
        url: prUrl,
        number: prNumber,
        state: mapGhState(parsed.state),
        isDraft:
          typeof parsed.isDraft === "boolean" ? parsed.isDraft : undefined,
      },
      title: prTitle,
      description: prBody,
    };

    log("INFO", "Created pull request", {
      taskId: check.taskId,
      runId: winner.runId,
      url: prUrl,
    });

    return metadata;
  } catch (error) {
    log("ERROR", "Failed to create pull request", {
      taskId: check.taskId,
      runId: winner.runId,
      error,
    });
    return null;
  }
}

export function registerTaskRunContext(
  taskRunId: string,
  context: WorkerRunContext
) {
  taskRunContexts.set(taskRunId, context);
}

export function clearTaskRunContext(taskRunId: string) {
  taskRunContexts.delete(taskRunId);
}

export async function handleWorkerTaskCompletion(
  taskRunId: string,
  opts: { agentModel?: string; elapsedMs?: number }
): Promise<void> {
  const { agentModel, elapsedMs } = opts;
  const context = taskRunContexts.get(taskRunId);
  if (!context) {
    log("WARNING", "No worker context found for completed task run", {
      taskRunId,
    });
    return;
  }

  const runContext = context;

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

    const branchForCommit =
      info?.taskRun?.newBranch ?? (await getCurrentBranch());

    if (branchForCommit) {
      try {
        await autoCommitAndPush({
          branchName: branchForCommit,
          commitMessage,
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
      });
    }

    const completion = await convexRequest<WorkerTaskRunResponse>(
      "/api/crown/complete",
      runContext.token,
      {
        taskRunId,
        exitCode: 0,
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
      const maxRetries = 5;
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
        log("INFO", "Crown evaluation already recorded", {
          taskRunId,
          winnerRunId: checkResponse.existingEvaluation.winnerRunId,
        });
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
          } satisfies CandidateData;
        })();

        const branchesReady = await ensureBranchesAvailable(
          [{ id: candidate.runId, newBranch: candidate.newBranch }],
          baseBranch,
          10,
          new Set(candidate.newBranch ? [candidate.newBranch] : [])
        );
        if (!branchesReady) {
          log("ERROR", "Branches not ready for single-run crown", {
            taskRunId,
          });
          return;
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
    clearTaskRunContext(taskRunId);
  }
}
