import { api } from "@cmux/convex/api";
import type { Id } from "@cmux/convex/dataModel";
import {
  buildEvaluationPrompt,
  buildSummarizationPrompt,
} from "@cmux/shared/crown/prompts";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { RepositoryManager } from "./repositoryManager";
import { collectRelevantDiff } from "./utils/collectRelevantDiff";
import { getConvex } from "./utils/convexClient";
import { serverLogger } from "./utils/fileLogger";
import { getGitHubTokenFromKeychain } from "./utils/getGitHubToken";
import { VSCodeInstance } from "./vscode/VSCodeInstance";
import { getProjectPaths } from "./workspace";

const UNKNOWN_AGENT_NAME = "unknown agent";

function getAgentNameOrUnknown(agentName?: string | null): string {
  const trimmed = agentName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : UNKNOWN_AGENT_NAME;
}

// Collect a filtered git diff between two refs using the Node implementation
async function getFilteredGitDiff(
  repoPath: string,
  baseRef: string,
  headRef: string
): Promise<string> {
  const repoManager = RepositoryManager.getInstance();
  let worktreePath: string | null = null;

  try {
    // First fetch both refs to ensure we have them
    serverLogger.info(
      `[CrownEvaluator] Fetching refs ${baseRef} and ${headRef} in ${repoPath}`
    );

    // Fetch the branches from origin
    try {
      await repoManager.executeGitCommand(
        `git fetch origin ${baseRef}:refs/remotes/origin/${baseRef} ${headRef}:refs/remotes/origin/${headRef}`,
        { cwd: repoPath }
      );
    } catch (e) {
      serverLogger.warn(
        `[CrownEvaluator] Failed to fetch refs, continuing: ${e}`
      );
    }

    const sanitizedHeadRef = headRef.replace(/[^a-zA-Z0-9._-]/g, "_");
    const worktreePrefix = path.join(
      tmpdir(),
      `cmux-crown-${sanitizedHeadRef || "head"}-`
    );

    worktreePath = await fs.mkdtemp(worktreePrefix);

    // Use a detached worktree for the agent branch
    await repoManager.executeGitCommand(
      `git worktree add --force --detach "${worktreePath}" origin/${headRef}`,
      { cwd: repoPath }
    );

    const resolvedBaseRef = baseRef.startsWith("origin/")
      ? baseRef
      : `origin/${baseRef}`;

    const diff = await collectRelevantDiff({
      repoPath: worktreePath,
      baseRef: resolvedBaseRef,
    });

    return diff.trim();
  } catch (error) {
    serverLogger.error(`[CrownEvaluator] Error getting filtered diff:`, error);
    return "";
  } finally {
    if (worktreePath) {
      try {
        await repoManager.executeGitCommand(
          `git worktree remove --force "${worktreePath}"`,
          { cwd: repoPath }
        );
      } catch (cleanupError) {
        serverLogger.warn(
          `[CrownEvaluator] Failed to remove worktree at ${worktreePath}:`,
          cleanupError
        );
      }

      try {
        await fs.rm(worktreePath, { recursive: true, force: true });
      } catch (cleanupError) {
        serverLogger.warn(
          `[CrownEvaluator] Failed to delete temp diff directory ${worktreePath}:`,
          cleanupError
        );
      }
    }
  }
}

// Auto PR behavior is controlled via workspace settings in Convex
export async function createPullRequestForWinner(
  taskRunId: Id<"taskRuns">,
  taskId: Id<"tasks">,
  githubToken: string | null | undefined,
  teamSlugOrId: string
): Promise<void> {
  try {
    // Check workspace settings toggle (default: disabled)
    const ws = await getConvex().query(api.workspaceSettings.get, {
      teamSlugOrId,
    });
    const autoPrEnabled = !!ws?.autoPrEnabled;
    if (!autoPrEnabled) {
      serverLogger.info(
        `[CrownEvaluator] Auto-PR disabled in settings; skipping.`
      );
      return;
    }
    serverLogger.info(
      `[CrownEvaluator] Creating pull request for winner ${taskRunId}`
    );

    // Get the task run details
    const taskRun = await getConvex().query(api.taskRuns.get, {
      teamSlugOrId,
      id: taskRunId,
    });
    if (!taskRun || !taskRun.vscode?.containerName) {
      serverLogger.error(
        `[CrownEvaluator] No VSCode instance found for task run ${taskRunId}`
      );
      return;
    }

    // Get the task details
    const task = await getConvex().query(api.tasks.getById, {
      teamSlugOrId,
      id: taskId,
    });
    if (!task) {
      serverLogger.error(`[CrownEvaluator] Task ${taskId} not found`);
      return;
    }

    // Find the VSCode instance
    const instances = VSCodeInstance.getInstances();
    let vscodeInstance: VSCodeInstance | null = null;

    // Look for the instance by taskRunId
    for (const [_id, instance] of instances) {
      if (instance.getTaskRunId() === taskRunId) {
        vscodeInstance = instance;
        break;
      }
    }

    if (!vscodeInstance) {
      serverLogger.error(
        `[CrownEvaluator] VSCode instance not found for task run ${taskRunId}`
      );
      return;
    }

    const agentName = getAgentNameOrUnknown(taskRun.agentName);

    // Create PR title and body using stored task title when available
    const prTitle =
      task.pullRequestTitle || task.text || "Task completed by cmux";
    // Persist PR title if not already set or differs
    if (!task.pullRequestTitle || task.pullRequestTitle !== prTitle) {
      try {
        await getConvex().mutation(api.tasks.setPullRequestTitle, {
          teamSlugOrId,
          id: taskId,
          pullRequestTitle: prTitle,
        });
      } catch (e) {
        serverLogger.error(`[CrownEvaluator] Failed to save PR title:`, e);
      }
    }
    const prBody = `## Summary
- Task completed by ${agentName} agent 🏆
- ${taskRun.crownReason || "Selected as the best implementation"}

## Details
- Task ID: ${taskId}
- Agent: ${agentName}
- Completed: ${new Date().toISOString()}`;

    // Persist PR description on the task in Convex
    try {
      await getConvex().mutation(api.tasks.setPullRequestDescription, {
        teamSlugOrId,
        id: taskId,
        pullRequestDescription: prBody,
      });
    } catch (e) {
      serverLogger.error(`[CrownEvaluator] Failed to save PR description:`, e);
    }

    // Use the newBranch from the task run
    const branchName = taskRun.newBranch || `cmux-crown-${taskRunId.slice(-8)}`;

    // Create commit message
    const truncatedDescription =
      prTitle.length > 72 ? prTitle.substring(0, 69) + "..." : prTitle;

    const commitMessage = `${truncatedDescription}

Task completed by ${agentName} agent 🏆
${taskRun.crownReason ? `\nReason: ${taskRun.crownReason}` : ""}

🤖 Generated with cmux
Agent: ${agentName}
Task Run ID: ${taskRunId}
Branch: ${branchName}
Completed: ${new Date().toISOString()}`;

    // Execute git operations via worker:exec only
    serverLogger.info(`[CrownEvaluator] Using worker:exec for git operations`);

    const workerSocket = vscodeInstance.getWorkerSocket();
    if (!workerSocket || !vscodeInstance.isWorkerConnected()) {
      serverLogger.error(`[CrownEvaluator] No worker connection available`);
      return;
    }

    // Execute git commands via worker:exec (more reliable than terminal-input)
    const bodyFileName = `cmux_pr_body_${Date.now()}_${Math.random().toString(36).slice(2)}.md`;
    const gitCommands = [
      // Add all changes
      { cmd: "git add -A", desc: "Staging changes" },
      // Create and switch to new branch (fallback to switch if it exists)
      {
        cmd: `git checkout -b ${branchName} || git checkout ${branchName}`,
        desc: "Ensuring branch",
      },
      // Commit (tolerate no-op)
      {
        cmd: `git commit -m "${commitMessage.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "\\$")}" || echo 'No changes to commit'`,
        desc: "Committing",
      },
      // Push
      { cmd: `git push -u origin ${branchName}`, desc: "Pushing branch" },
    ];

    // Only add PR creation command if GitHub token is available
    if (githubToken) {
      gitCommands.push({
        cmd: `cat <<'CMUX_EOF' > /tmp/${bodyFileName}\n${prBody}\nCMUX_EOF`,
        desc: "Writing PR body",
      });
      gitCommands.push({
        cmd: `GH_TOKEN="${githubToken}" gh pr create --title "${prTitle.replace(/"/g, '\\"')}" --body-file /tmp/${bodyFileName} --head "${branchName}"`,
        desc: "Creating PR",
      });
      gitCommands.push({
        cmd: `rm -f /tmp/${bodyFileName}`,
        desc: "Cleaning up PR body",
      });
    } else {
      serverLogger.info(
        `[CrownEvaluator] Skipping PR creation - no GitHub token configured`
      );
      serverLogger.info(
        `[CrownEvaluator] Branch '${branchName}' has been pushed. You can manually create a PR from GitHub.`
      );
    }

    for (const { cmd, desc } of gitCommands) {
      serverLogger.info(`[CrownEvaluator] ${desc}...`);

      const result = await new Promise<{
        success: boolean;
        error?: string;
        stdout?: string;
        stderr?: string;
      }>((resolve) => {
        workerSocket.timeout(30000).emit(
          "worker:exec",
          {
            command: "/bin/bash",
            args: ["-c", cmd],
            cwd: "/root/workspace",
            env: githubToken ? { GH_TOKEN: githubToken } : {},
          },
          (timeoutError, result) => {
            if (timeoutError) {
              resolve({ success: false, error: "Command timeout" });
              return;
            }
            if (result.error) {
              resolve({ success: false, error: result.error.message });
              return;
            }

            const { stdout, stderr, exitCode } = result.data;
            serverLogger.info(`[CrownEvaluator] ${desc} - stdout:`, stdout);
            if (stderr) {
              serverLogger.info(`[CrownEvaluator] ${desc} - stderr:`, stderr);
            }

            resolve({ success: exitCode === 0, stdout, stderr });
          }
        );
      });

      if (!result.success) {
        serverLogger.error(
          `[CrownEvaluator] Failed at step: ${desc}`,
          result.error
        );

        // If gh pr create fails, log more details
        if (cmd.includes("gh pr create")) {
          serverLogger.error(
            `[CrownEvaluator] PR creation failed. stdout: ${result.stdout}, stderr: ${result.stderr}`
          );

          // Try to check gh auth status
          const authCheckResult = await new Promise<{
            success: boolean;
            stdout?: string;
            stderr?: string;
          }>((resolve) => {
            workerSocket.timeout(10000).emit(
              "worker:exec",
              {
                command: "/bin/bash",
                args: [
                  "-c",
                  githubToken
                    ? `GH_TOKEN="${githubToken}" gh auth status`
                    : "gh auth status",
                ],
                cwd: "/root/workspace",
                env: githubToken ? { GH_TOKEN: githubToken } : {},
              },
              (timeoutError, authResult) => {
                if (timeoutError || authResult.error) {
                  resolve({
                    success: false,
                    stdout: "",
                    stderr: timeoutError
                      ? "timeout"
                      : authResult.error?.message,
                  });
                  return;
                }
                const { stdout, stderr, exitCode } = authResult.data;
                resolve({ success: exitCode === 0, stdout, stderr });
              }
            );
          });

          serverLogger.error(
            `[CrownEvaluator] gh auth status - stdout: ${authCheckResult.stdout}, stderr: ${authCheckResult.stderr}`
          );
        }

        // Continue anyway for some commands
        if (!cmd.includes("git checkout") && !cmd.includes("gh pr create")) {
          return;
        }
      } else {
        // If successful and it's the PR creation command, log the URL
        if (cmd.includes("gh pr create") && result.stdout) {
          serverLogger.info(`[CrownEvaluator] PR created successfully!`);
          serverLogger.info(`[CrownEvaluator] PR URL: ${result.stdout.trim()}`);
        }
      }
    }

    serverLogger.info(`[CrownEvaluator] Pull request creation completed`);
  } catch (error) {
    serverLogger.error(`[CrownEvaluator] Error creating pull request:`, error);
  }
}

type EvaluateCrownOptions = {
  taskId: Id<"tasks">;
  teamSlugOrId: string;
};

export async function evaluateCrown({
  taskId,
  teamSlugOrId,
}: EvaluateCrownOptions): Promise<void> {
  serverLogger.info(
    `[CrownEvaluator] =================================================`
  );
  serverLogger.info(
    `[CrownEvaluator] STARTING CROWN EVALUATION FOR TASK ${taskId}`
  );
  serverLogger.info(
    `[CrownEvaluator] =================================================`
  );

  try {
    // Atomically acquire crown evaluation lock to avoid duplicate runs
    try {
      const acquired = await getConvex().mutation(
        api.tasks.tryBeginCrownEvaluation,
        { teamSlugOrId, id: taskId }
      );
      if (!acquired) {
        serverLogger.info(
          `[CrownEvaluator] Another evaluation is already in progress; skipping.`
        );
        return;
      }
    } catch (lockErr) {
      serverLogger.error(
        `[CrownEvaluator] Failed to acquire evaluation lock:`,
        lockErr
      );
      // Best-effort continue; downstream guards will prevent duplicate effects
    }

    const githubToken = await getGitHubTokenFromKeychain();

    // Helper: generate and persist a system task comment summarizing the winner
    const generateSystemTaskComment = async (
      winnerRunId: Id<"taskRuns">,
      originPath: string,
      baseRef: string
    ) => {
      try {
        // Skip if a system comment already exists for this task
        const existing = await getConvex().query(
          api.taskComments.latestSystemByTask,
          { teamSlugOrId, taskId }
        );
        if (existing) {
          serverLogger.info(
            `[CrownEvaluator] System task comment already exists; skipping generation.`
          );
          return;
        }

        // Try to get the winner's branch name
        const winnerRun = await getConvex().query(api.taskRuns.get, {
          teamSlugOrId,
          id: winnerRunId,
        });
        // Collect the diff for the winner
        let effectiveDiff = "";
        if (winnerRun?.newBranch && originPath) {
          try {
            effectiveDiff = await getFilteredGitDiff(
              originPath,
              baseRef,
              winnerRun.newBranch
            );
          } catch (e) {
            serverLogger.error(
              `[CrownEvaluator] Failed to get diff for winner:`,
              e
            );
          }
        }

        // Pull original request text for context
        const task = await getConvex().query(api.tasks.getById, {
          teamSlugOrId,
          id: taskId,
        });
        const originalRequest = task?.text || "";

        const summarizationPrompt = buildSummarizationPrompt(
          originalRequest,
          effectiveDiff
        );

        serverLogger.info(
          `[CrownEvaluator] Generating PR summary via Anthropic (AI SDK)...`
        );

        let commentText = "";
        try {
          const result = await getConvex().action(
            api.crown.actions.summarize,
            // (api as any)["crown/actions"].summarize,
            {
              taskText: originalRequest,
              gitDiff: effectiveDiff,
              teamSlugOrId,
            }
          );
          commentText = result.summary;
          if (result.prompt !== summarizationPrompt) {
            serverLogger.debug(
              "[CrownEvaluator] Summarization prompt differed between server and Convex"
            );
          }
        } catch (e) {
          serverLogger.error(
            `[CrownEvaluator] Failed to generate PR summary:`,
            e
          );
          return;
        }

        if (commentText.length > 8000) {
          commentText = commentText.slice(0, 8000) + "\n\n… (truncated)";
        }

        await getConvex().mutation(api.taskComments.createSystemForTask, {
          teamSlugOrId,
          taskId,
          content: commentText,
        });

        serverLogger.info(
          `[CrownEvaluator] Saved system task comment for task ${taskId}`
        );
      } catch (e) {
        serverLogger.error(
          `[CrownEvaluator] Failed to create system task comment:`,
          e
        );
      }
    };

    // Get task and runs
    const task = await getConvex().query(api.tasks.getById, {
      teamSlugOrId,
      id: taskId,
    });
    if (!task) {
      throw new Error("Task not found");
    }

    const taskRuns = await getConvex().query(api.taskRuns.getByTask, {
      teamSlugOrId,
      taskId,
    });
    const completedRuns = taskRuns.filter((run) => run.status === "completed");

    if (completedRuns.length < 2) {
      serverLogger.info(
        `[CrownEvaluator] Not enough completed runs (${completedRuns.length})`
      );
      return;
    }

    // Double-check if evaluation already exists
    const existingEvaluation = await getConvex().query(
      api.crown.getCrownEvaluation,
      {
        teamSlugOrId,
        taskId,
      }
    );

    if (existingEvaluation) {
      serverLogger.info(
        `[CrownEvaluator] Crown evaluation already exists for task ${taskId}, skipping`
      );
      // Clear the pending status
      await getConvex().mutation(api.tasks.updateCrownError, {
        teamSlugOrId,
        id: taskId,
        crownEvaluationError: undefined,
      });
      return;
    }

    // Get repository information for fetching diffs from pushed branches
    const taskInfo = await getConvex().query(api.tasks.getById, {
      teamSlugOrId,
      id: taskId,
    });

    let originPath = "";
    if (taskInfo?.projectFullName) {
      const repo = await getConvex().query(api.github.getRepoByFullName, {
        teamSlugOrId,
        fullName: taskInfo.projectFullName,
      });
      if (repo?.gitRemote) {
        const { originPath: repoPath } = await getProjectPaths(
          repo.gitRemote,
          teamSlugOrId
        );
        originPath = repoPath;
      }
    }

    // Determine base branch for diffs
    let baseRef = "main";
    if (originPath) {
      const repoManager = RepositoryManager.getInstance();
      try {
        const { stdout } = await repoManager.executeGitCommand(
          "git symbolic-ref refs/remotes/origin/HEAD",
          { cwd: originPath, suppressErrorLogging: true }
        );
        if (stdout && stdout.includes("refs/remotes/origin/")) {
          baseRef = stdout.trim().replace("refs/remotes/origin/", "");
        }
      } catch {
        // Try common defaults
        try {
          await repoManager.executeGitCommand(
            "git rev-parse --verify origin/main",
            { cwd: originPath, suppressErrorLogging: true }
          );
          baseRef = "main";
        } catch {
          try {
            await repoManager.executeGitCommand(
              "git rev-parse --verify origin/master",
              { cwd: originPath, suppressErrorLogging: true }
            );
            baseRef = "master";
          } catch {
            // Keep default
          }
        }
      }
    }

    const candidateData = await Promise.all(
      completedRuns.map(async (run, idx) => {
        const agentName = getAgentNameOrUnknown(run.agentName);
        let gitDiff = "";

        // Get diff from git branch if available
        if (run.newBranch && originPath) {
          try {
            serverLogger.info(
              `[CrownEvaluator] Fetching diff from branch ${run.newBranch} for ${agentName}`
            );
            gitDiff = await getFilteredGitDiff(
              originPath,
              baseRef,
              run.newBranch
            );
          } catch (e) {
            serverLogger.error(
              `[CrownEvaluator] Failed to fetch diff from branch ${run.newBranch}:`,
              e
            );
          }
        }

        if (!gitDiff || gitDiff.length === 0) {
          gitDiff = "No changes detected";
        }

        // Limit to 5000 chars for the prompt
        if (gitDiff.length > 5000) {
          gitDiff = gitDiff.substring(0, 5000) + "\n... (truncated)";
        }

        serverLogger.info(
          `[CrownEvaluator] Implementation ${idx} (${agentName}): ${gitDiff.length} chars of diff`
        );

        return {
          index: idx,
          runId: run._id,
          agentName,
          exitCode: run.exitCode || 0,
          gitDiff,
        };
      })
    );

    const evaluationCandidates = candidateData.map((candidate) => ({
      runId: candidate.runId,
      agentName: candidate.agentName,
      gitDiff: candidate.gitDiff,
    }));

    const taskText = task.text ?? "";

    const evaluationPromptForLogging = buildEvaluationPrompt(
      taskText,
      evaluationCandidates
    );

    serverLogger.info(
      `[CrownEvaluator] Evaluation prompt length: ${evaluationPromptForLogging.length} characters`
    );

    // Log prompt structure for debugging
    const promptLines = evaluationPromptForLogging.split("\n");
    serverLogger.info(
      `[CrownEvaluator] Prompt has ${promptLines.length} lines`
    );
    serverLogger.info(`[CrownEvaluator] First 5 lines of prompt:`);
    promptLines.slice(0, 5).forEach((line, idx) => {
      serverLogger.info(
        `[CrownEvaluator]   ${idx}: ${line.substring(0, 100)}${line.length > 100 ? "..." : ""}`
      );
    });

    // Status already set by tryBeginCrownEvaluation; keep for compatibility if not set
    try {
      await getConvex().mutation(api.tasks.updateCrownError, {
        teamSlugOrId,
        id: taskId,
        crownEvaluationError: "in_progress",
      });
    } catch {
      /* empty */
    }

    // Use Convex action for evaluation - API key is handled securely in Convex
    const jsonResponse = await getConvex().action(api.crown.actions.evaluate, {
      taskText,
      candidates: evaluationCandidates,
      teamSlugOrId,
    });

    if (jsonResponse.prompt !== evaluationPromptForLogging) {
      serverLogger.debug(
        "[CrownEvaluator] Evaluation prompt differed between server and Convex"
      );
    }

    if (
      typeof jsonResponse.winner !== "number" ||
      jsonResponse.winner < 0 ||
      jsonResponse.winner >= candidateData.length
    ) {
      throw new Error(
        `Crown evaluate returned invalid winner index ${jsonResponse.winner}`
      );
    }

    const winner = candidateData[jsonResponse.winner];
    serverLogger.info(
      `[CrownEvaluator] WINNER SELECTED: ${winner.agentName} (index ${jsonResponse.winner})`
    );
    serverLogger.info(`[CrownEvaluator] Reason: ${jsonResponse.reason}`);

    // Update the database
    await getConvex().mutation(api.crown.setCrownWinner, {
      teamSlugOrId,
      taskRunId: winner.runId,
      reason: jsonResponse.reason,
    });

    // Clear any error
    await getConvex().mutation(api.tasks.updateCrownError, {
      teamSlugOrId,
      id: taskId,
      crownEvaluationError: undefined,
    });

    serverLogger.info(
      `[CrownEvaluator] Crown evaluation completed successfully for task ${taskId}`
    );

    // Create pull request for the winner
    await createPullRequestForWinner(
      winner.runId,
      taskId,
      githubToken || undefined,
      teamSlugOrId
    );
    // After choosing a winner, generate and persist a task comment (by cmux)
    await generateSystemTaskComment(winner.runId, originPath, baseRef);
  } catch (error) {
    serverLogger.error(`[CrownEvaluator] Error during evaluation:`, error);

    // Update task with error status
    await getConvex().mutation(api.tasks.updateCrownError, {
      teamSlugOrId,
      id: taskId,
      crownEvaluationError: `Failed: ${error instanceof Error ? error.message : String(error)}`,
    });

    throw error;
  }
}
