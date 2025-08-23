import { api } from "@cmux/convex/api";
import type { Id } from "@cmux/convex/dataModel";
import type { AgentConfig } from "@cmux/shared";
import { tryVSCodeExtensionCommit } from "./tryVSCodeExtensionCommit";
import { convex } from "./utils/convexClient";
import { serverLogger } from "./utils/fileLogger";
import { VSCodeInstance } from "./vscode/VSCodeInstance";

/**
 * Automatically commit and push changes when a task completes
 */

export default async function performAutoCommitAndPush(
  vscodeInstance: VSCodeInstance,
  agent: AgentConfig,
  taskRunId: string | Id<"taskRuns">,
  taskDescription: string
): Promise<void> {
  try {
    serverLogger.info(`[AgentSpawner] Starting auto-commit for ${agent.name}`);
    const workerSocket = vscodeInstance.getWorkerSocket();

    // Check if this run is crowned
    const taskRun = await convex.query(api.taskRuns.get, {
      id: taskRunId as Id<"taskRuns">,
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

    const commitMessage = `${truncatedDescription}

Task completed by ${agent.name} agent${isCrowned ? " 🏆" : ""}

🤖 Generated with cmux
Agent: ${agent.name}
Task Run ID: ${taskRunId}
Branch: ${branchName}
Completed: ${new Date().toISOString()}`;

    // Try to use VSCode extension API first (more reliable)
    const extensionResult = await tryVSCodeExtensionCommit(
      vscodeInstance,
      branchName,
      commitMessage,
      agent.name
    );

    if (extensionResult.success) {
      serverLogger.info(
        `[AgentSpawner] Successfully committed and pushed via VSCode extension`
      );
      serverLogger.info(`[AgentSpawner] Branch: ${branchName}`);
      serverLogger.info(
        `[AgentSpawner] Commit message: ${commitMessage.split("\n")[0]}`
      );
    } else {
      serverLogger.info(
        `[AgentSpawner] VSCode extension method failed, falling back to git commands:`,
        extensionResult.error
      );

      // Fallback to direct git commands
      if (!workerSocket || !vscodeInstance.isWorkerConnected()) {
        serverLogger.info(
          `[AgentSpawner] No worker connection for auto-commit fallback`
        );
        return;
      }

      // Execute git commands in sequence (robust and minimal escaping)
      const gitCommands = [
        // Stage all changes including deletions
        `git add -A`,
        // Ensure target branch exists; create or switch
        `git checkout -b ${branchName} || git checkout ${branchName}`,
        // Commit with JSON-escaped message; tolerate no-op
        `git commit -m ${JSON.stringify(commitMessage)} || echo 'No changes to commit'`,
        // If remote branch exists, integrate updates before pushing
        `git ls-remote --heads origin ${branchName} | grep -q . && git pull --rebase origin ${branchName} || echo 'Remote branch missing; skip pull --rebase'`,
        // Always push and set upstream
        `git push -u origin ${branchName}`,
      ];

      for (const command of gitCommands) {
        serverLogger.info(`[AgentSpawner] Executing: ${command}`);

        const result = await new Promise<{
          success: boolean;
          stdout?: string;
          stderr?: string;
          exitCode?: number;
          error?: string;
        }>((resolve) => {
          workerSocket.timeout(30000).emit(
            "worker:exec",
            {
              command: "bash",
              args: ["-c", command],
              cwd: "/root/workspace",
              env: {},
            },
            (timeoutError: unknown, execResult: any) => {
              if (timeoutError) {
                serverLogger.error(
                  `[AgentSpawner] Timeout executing: ${command}`,
                  timeoutError
                );
                resolve({
                  success: false,
                  error: "Timeout waiting for git command",
                });
                return;
              }
              if (execResult?.error) {
                resolve({ success: false, error: String(execResult.error) });
                return;
              }

              const { stdout, stderr, exitCode } = execResult.data as {
                stdout: string;
                stderr: string;
                exitCode: number;
              };
              serverLogger.info(`[AgentSpawner] Command output:`, {
                stdout,
                stderr,
                exitCode,
              });

              if (exitCode === 0) {
                resolve({ success: true, stdout, stderr, exitCode });
              } else {
                resolve({
                  success: false,
                  stdout,
                  stderr,
                  exitCode,
                  error: `Command failed with exit code ${exitCode}`,
                });
              }
            }
          );
        });

        if (!result.success) {
          serverLogger.error(
            `[AgentSpawner] Git command failed: ${command}`,
            result.error
          );
          // Don't stop on individual command failures - some might be expected (e.g., no changes to commit)
          continue;
        }
      }
    }

    if (isCrowned) {
      // Respect workspace setting for auto-PR
      const ws = await convex.query(api.workspaceSettings.get);
      const autoPrEnabled =
        (ws as unknown as { autoPrEnabled?: boolean })?.autoPrEnabled ?? false;
      if (!autoPrEnabled) {
        serverLogger.info(
          `[AgentSpawner] Branch pushed (auto-PR disabled). Winner: ${agent.name} on ${branchName}`
        );
        return;
      }
      serverLogger.info(
        `[AgentSpawner] Auto-commit completed for ${agent.name} on branch ${branchName} (crowned - creating PR)`
      );

      // Create PR for crowned run only
      try {
        if (!taskRun) {
          serverLogger.error(
            `[AgentSpawner] Task run not found for PR creation`
          );
          return;
        }
        const task = await convex.query(api.tasks.getById, {
          id: taskRun.taskId,
        });
        if (task) {
          // Use existing task PR title when present, otherwise derive and persist
          const prTitle = task.pullRequestTitle || `[Crown] ${task.text}`;
          if (!task.pullRequestTitle || task.pullRequestTitle !== prTitle) {
            try {
              await convex.mutation(api.tasks.setPullRequestTitle, {
                id: task._id,
                pullRequestTitle: prTitle,
              });
            } catch (e) {
              serverLogger.error(`[AgentSpawner] Failed to save PR title:`, e);
            }
          }
          const prBody = `## 🏆 Crown Winner: ${agent.name}

### Task Description
${task.text}
${task.description ? `\n${task.description}` : ""}

### Crown Evaluation
${taskRun.crownReason || "This implementation was selected as the best solution."}

### Implementation Details
- **Agent**: ${agent.name}
- **Task ID**: ${task._id}
- **Run ID**: ${taskRun._id}
- **Branch**: ${branchName}
- **Completed**: ${new Date(taskRun.completedAt || Date.now()).toISOString()}`;

          // Persist PR description on the task in Convex
          try {
            await convex.mutation(api.tasks.setPullRequestDescription, {
              id: task._id,
              pullRequestDescription: prBody,
            });
          } catch (e) {
            serverLogger.error(
              `[AgentSpawner] Failed to save PR description:`,
              e
            );
          }

          const bodyFileVar = `cmux_pr_body_${Date.now()}_${Math.random().toString(36).slice(2)}.md`;
          const prScript =
            `set -e\n` +
            `BODY_FILE="/tmp/${bodyFileVar}"\n` +
            `cat <<'CMUX_EOF' > "$BODY_FILE"\n` +
            `${prBody}\n` +
            `CMUX_EOF\n` +
            `gh pr create --title ${JSON.stringify(prTitle)} --body-file "$BODY_FILE"\n` +
            `rm -f "$BODY_FILE"`;

          const prResult = await new Promise<{
            success: boolean;
            output?: string;
            error?: string;
          }>((resolve) => {
            workerSocket.timeout(30000).emit(
              "worker:exec",
              {
                command: "/bin/bash",
                args: ["-lc", prScript],
                cwd: "/root/workspace",
              },
              (err: unknown, response: any) => {
                if (err || response?.error) {
                  const e = err || response?.error;
                  resolve({ success: false, error: String(e) });
                } else {
                  // Extract PR URL from output
                  const output = response?.stdout || "";
                  const prUrlMatch = output.match(
                    /https:\/\/github\.com\/[\w-]+\/[\w-]+\/pull\/\d+/
                  );
                  resolve({
                    success: true,
                    output: prUrlMatch ? prUrlMatch[0] : output,
                  });
                }
              }
            );
          });

          if (prResult.success && prResult.output) {
            serverLogger.info(
              `[AgentSpawner] Pull request created: ${prResult.output}`
            );
            await convex.mutation(api.taskRuns.updatePullRequestUrl, {
              id: taskRunId as Id<"taskRuns">,
              pullRequestUrl: prResult.output,
              isDraft: false,
            });
          } else {
            serverLogger.error(
              `[AgentSpawner] Failed to create PR: ${prResult.error}`
            );
          }
        }
      } catch (error) {
        serverLogger.error(`[AgentSpawner] Error creating PR:`, error);
      }
    } else {
      serverLogger.info(
        `[AgentSpawner] Auto-commit completed for ${agent.name} on branch ${branchName} (not crowned - branch pushed)`
      );
    }
  } catch (error) {
    serverLogger.error(`[AgentSpawner] Error in auto-commit and push:`, error);
  }
}
