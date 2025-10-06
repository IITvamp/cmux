import { api } from "@cmux/convex/api";
import type { Id } from "@cmux/convex/dataModel";
import type { IMainServerRpc, ReplaceDiffEntry } from "@cmux/shared";
import { RpcTarget } from "capnweb";
import fuzzysort from "fuzzysort";
import { minimatch } from "minimatch";
import { exec, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";
import { spawnAllAgents } from "./agentSpawner";
import { stopContainersForRuns } from "./archiveTask";
import { execWithEnv } from "./execWithEnv";
import { getGitDiff } from "./diffs/gitDiff";
import type { GitDiffManager } from "./gitDiff";
import { getRustTime } from "./native/core";
import { RepositoryManager } from "./repositoryManager";
import { getPRTitleFromTaskDescription } from "./utils/branchNameGenerator";
import { getConvex } from "./utils/convexClient";
import { serverLogger } from "./utils/fileLogger";
import { getGitHubTokenFromKeychain } from "./utils/getGitHubToken";
import { createDraftPr, fetchPrDetail } from "./utils/githubPr";
import { checkAllProvidersStatus } from "./utils/providerStatus";
import { refreshGitHubData } from "./utils/refreshGitHubData";
import { getProjectPaths } from "./workspace";
import {
  collectRepoFullNamesForRun,
  EMPTY_AGGREGATE,
  loadPullRequestDetail,
  persistPullRequestResults,
  splitRepoFullName,
  toPullRequestActionResult,
} from "./pullRequestState";

/**
 * Server RPC handler implementation
 * 
 * This class extends RpcTarget and implements IMainServerRpc using Cap'n Web RPC.
 * It contains all the handler logic previously in socket-handlers.ts.
 */
export class ServerRpcHandlers extends RpcTarget implements IMainServerRpc {
  constructor(
    private readonly gitDiffManager: GitDiffManager,
    private readonly teamSlugOrId: string,
  ) {
    super();
  }

  async rustGetTime() {
    try {
      const time = await getRustTime();
      return { ok: true as const, time };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false as const, error: msg };
    }
  }

  async gitDiff(data: {
    headRef: string;
    baseRef?: string;
    repoFullName?: string;
    repoUrl?: string;
    originPathOverride?: string;
    includeContents?: boolean;
    maxBytes?: number;
    lastKnownBaseSha?: string;
    lastKnownMergeCommitSha?: string;
  }) {
    try {
      if (
        !data.repoFullName &&
        !data.repoUrl &&
        !data.originPathOverride
      ) {
        throw new Error(
          "repoFullName, repoUrl, or originPathOverride is required",
        );
      }

      const diffs = await getGitDiff({
        headRef: data.headRef,
        baseRef: data.baseRef,
        repoFullName: data.repoFullName,
        repoUrl: data.repoUrl,
        originPathOverride: data.originPathOverride,
        includeContents: data.includeContents ?? true,
        maxBytes: data.maxBytes,
        teamSlugOrId: this.teamSlugOrId,
        lastKnownBaseSha: data.lastKnownBaseSha,
        lastKnownMergeCommitSha: data.lastKnownMergeCommitSha,
      });

      // Note: File watching is removed in the RPC version
      // Clients should poll for changes instead

      return { ok: true as const, diffs };
    } catch (error) {
      serverLogger.error("Error in git-diff:", error);
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Unknown error",
        diffs: [] as [],
      };
    }
  }

  async startTask(data: {
    repoUrl?: string;
    branch?: string;
    taskDescription: string;
    projectFullName: string;
    taskId: Id<"tasks">;
    selectedAgents?: string[];
    isCloudMode?: boolean;
    images?: Array<{
      src: string;
      fileName?: string;
      altText: string;
    }>;
    theme?: "dark" | "light" | "system";
    environmentId?: Id<"environments">;
  }) {
    const taskId = data.taskId;
    try {
      // For local mode, ensure Docker is running before attempting to spawn
      if (!data.isCloudMode) {
        try {
          const { checkDockerStatus } = await import("@cmux/shared");
          const docker = await checkDockerStatus();
          if (!docker.isRunning) {
            return {
              taskId,
              error:
                "Docker is not running. Please start Docker Desktop or switch to Cloud mode.",
            };
          }
        } catch (e) {
          serverLogger.warn(
            "Failed to verify Docker status before start-task",
            e,
          );
          return {
            taskId,
            error:
              "Unable to verify Docker status. Ensure Docker is running or switch to Cloud mode.",
          };
        }
      }

      // Generate PR title early from the task description
      let generatedTitle: string | null = null;
      try {
        generatedTitle = await getPRTitleFromTaskDescription(
          data.taskDescription,
          this.teamSlugOrId,
        );
        // Persist to Convex immediately
        await getConvex().mutation(api.tasks.setPullRequestTitle, {
          teamSlugOrId: this.teamSlugOrId,
          id: taskId,
          pullRequestTitle: generatedTitle,
        });
        serverLogger.info(`[Server] Saved early PR title: ${generatedTitle}`);
      } catch (e) {
        serverLogger.error(
          `[Server] Failed generating/saving early PR title:`,
          e,
        );
      }

      // Spawn all agents in parallel (each will create its own taskRun)
      const agentResults = await spawnAllAgents(
        taskId,
        {
          repoUrl: data.repoUrl,
          branch: data.branch,
          taskDescription: data.taskDescription,
          prTitle: generatedTitle ?? undefined,
          selectedAgents: data.selectedAgents,
          isCloudMode: data.isCloudMode,
          images: data.images,
          theme: data.theme,
          environmentId: data.environmentId,
        },
        this.teamSlugOrId,
      );

      // Check if at least one agent spawned successfully
      const successfulAgents = agentResults.filter(
        (result) => result.success,
      );
      if (successfulAgents.length === 0) {
        const errors = agentResults
          .filter((r) => !r.success)
          .map((r) => `${r.agentName}: ${r.error || "Unknown error"}`)
          .join("; ");
        return {
          taskId,
          error: errors || "Failed to spawn any agents",
        };
      }

      // Log results for debugging
      agentResults.forEach((result) => {
        if (result.success) {
          serverLogger.info(
            `Successfully spawned ${result.agentName} with terminal ${result.terminalId}`,
          );
          if (result.vscodeUrl) {
            serverLogger.info(
              `VSCode URL for ${result.agentName}: ${result.vscodeUrl}`,
            );
          }
        } else {
          serverLogger.error(
            `Failed to spawn ${result.agentName}: ${result.error}`,
          );
        }
      });

      // Return the first successful agent's info
      const primaryAgent = successfulAgents[0];

      // Note: VSCode spawned broadcast is removed in RPC version
      // Clients should poll Convex for VSCode URL updates

      return {
        taskId,
        worktreePath: primaryAgent.worktreePath,
        terminalId: primaryAgent.terminalId,
      };
    } catch (error) {
      serverLogger.error("Error in start-task:", error);
      return {
        taskId,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async githubSyncPrState(data: { taskRunId: Id<"taskRuns"> }) {
    try {
      const run = await getConvex().query(api.taskRuns.get, {
        teamSlugOrId: this.teamSlugOrId,
        id: data.taskRunId,
      });
      if (!run) {
        return {
          success: false,
          results: [],
          aggregate: EMPTY_AGGREGATE,
          error: "Task run not found",
        };
      }

      const task = await getConvex().query(api.tasks.getById, {
        teamSlugOrId: this.teamSlugOrId,
        id: run.taskId,
      });
      if (!task) {
        return {
          success: false,
          results: [],
          aggregate: EMPTY_AGGREGATE,
          error: "Task not found",
        };
      }

      const githubToken = await getGitHubTokenFromKeychain();
      if (!githubToken) {
        return {
          success: false,
          results: [],
          aggregate: EMPTY_AGGREGATE,
          error: "GitHub token is not configured",
        };
      }

      const repoFullNames = await collectRepoFullNamesForRun(
        run,
        task,
        this.teamSlugOrId,
      );
      if (repoFullNames.length === 0) {
        return {
          success: true,
          results: [],
          aggregate: EMPTY_AGGREGATE,
        };
      }

      const existingByRepo = new Map(
        (run.pullRequests ?? []).map(
          (record) => [record.repoFullName, record] as const,
        ),
      );

      const results = await Promise.all(
        repoFullNames.map(async (repoFullName) => {
          try {
            const split = splitRepoFullName(repoFullName);
            if (!split) {
              throw new Error(`Invalid repository name: ${repoFullName}`);
            }
            const { owner, repo } = split;
            const existingRecord = existingByRepo.get(repoFullName);

            const detail = await loadPullRequestDetail({
              token: githubToken,
              repoFullName,
              owner,
              repo,
              branchName: run.newBranch ?? "",
              number: existingRecord?.number,
            });

            if (!detail) {
              return {
                repoFullName,
                url: undefined,
                number: undefined,
                state: "none" as const,
                isDraft: undefined,
              };
            }

            return toPullRequestActionResult(repoFullName, detail);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            return {
              repoFullName,
              url: undefined,
              number: undefined,
              state: "unknown" as const,
              isDraft: undefined,
              error: message,
            };
          }
        }),
      );

      const persisted = await persistPullRequestResults({
        teamSlugOrId: this.teamSlugOrId,
        run,
        task,
        repoFullNames,
        results,
      });

      const errors = results
        .filter((result) => result.error)
        .map((result) => `${result.repoFullName}: ${result.error}`);

      return {
        success: errors.length === 0,
        results,
        aggregate: persisted.aggregate,
        error: errors.length > 0 ? errors.join("; ") : undefined,
      };
    } catch (error) {
      serverLogger.error("Error syncing PR state:", error);
      return {
        success: false,
        results: [],
        aggregate: EMPTY_AGGREGATE,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async githubMergeBranch(data: { taskRunId: Id<"taskRuns"> }) {
    try {
      const { ensureRunWorktreeAndBranch } = await import(
        "./utils/ensureRunWorktree"
      );
      const { run, task, branchName, baseBranch } =
        await ensureRunWorktreeAndBranch(data.taskRunId, this.teamSlugOrId);

      const githubToken = await getGitHubTokenFromKeychain();
      if (!githubToken) {
        return {
          success: false,
          error: "GitHub token is not configured",
        };
      }

      const repoFullName = task.projectFullName || "";
      const [owner, repo] = repoFullName.split("/");
      if (!owner || !repo) {
        return { success: false, error: "Unknown repo for task" };
      }

      try {
        const { getOctokit } = await import("./utils/octokit");
        const octokit = getOctokit(githubToken);
        const { data: mergeRes } = await octokit.rest.repos.merge({
          owner,
          repo,
          base: baseBranch,
          head: branchName,
        });

        const existingRecords = run.pullRequests ?? [];
        const updatedRecords = existingRecords.length > 0
          ? existingRecords.map((record) =>
              record.repoFullName === repoFullName
                ? {
                    ...record,
                    state: "merged" as const,
                    isDraft: false,
                  }
                : record,
            )
          : [
              {
                repoFullName,
                url:
                  run.pullRequestUrl && run.pullRequestUrl !== "pending"
                    ? run.pullRequestUrl
                    : undefined,
                number: run.pullRequestNumber ?? undefined,
                state: "merged" as const,
                isDraft: false,
              },
            ];

        await getConvex().mutation(api.taskRuns.updatePullRequestState, {
          teamSlugOrId: this.teamSlugOrId,
          id: run._id,
          state: "merged",
          isDraft: false,
          pullRequests: updatedRecords,
        });

        await getConvex().mutation(api.tasks.updateMergeStatus, {
          teamSlugOrId: this.teamSlugOrId,
          id: task._id,
          mergeStatus: "pr_merged",
        });

        return { success: true, merged: true, commitSha: mergeRes.sha };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          success: false,
          error: `Failed to merge branch: ${msg}`,
        };
      }
    } catch (error) {
      serverLogger.error("Error merging branch:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async gitFullDiff(data: { workspacePath: string }) {
    try {
      const diff = await this.gitDiffManager.getFullDiff(data.workspacePath);
      return { diff };
    } catch (error) {
      serverLogger.error("Error getting full git diff:", error);
      return {
        diff: "",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async openInEditor(data: {
    editor:
      | "vscode"
      | "cursor"
      | "windsurf"
      | "finder"
      | "iterm"
      | "terminal"
      | "ghostty"
      | "alacritty"
      | "xcode";
    path: string;
  }) {
    try {
      let command: string[];
      switch (data.editor) {
        case "vscode":
          command = ["code", data.path];
          break;
        case "cursor":
          command = ["cursor", data.path];
          break;
        case "windsurf":
          command = ["windsurf", data.path];
          break;
        case "finder": {
          if (process.platform !== "darwin") {
            throw new Error("Finder is only supported on macOS");
          }
          command = ["open", data.path];
          break;
        }
        case "iterm":
          command = ["open", "-a", "iTerm", data.path];
          break;
        case "terminal":
          command = ["open", "-a", "Terminal", data.path];
          break;
        case "ghostty":
          command = ["open", "-a", "Ghostty", data.path];
          break;
        case "alacritty":
          command = ["alacritty", "--working-directory", data.path];
          break;
        case "xcode":
          command = ["open", "-a", "Xcode", data.path];
          break;
        default:
          throw new Error(`Unknown editor: ${data.editor}`);
      }

      return new Promise<{ success: boolean; error?: string }>((resolve) => {
        const childProcess = spawn(command[0], command.slice(1));

        childProcess.on("close", (code) => {
          if (code === 0) {
            serverLogger.info(`Successfully opened ${data.path} in ${data.editor}`);
            resolve({ success: true });
          } else {
            serverLogger.error(
              `Error opening ${data.editor}: process exited with code ${code}`,
            );
            resolve({
              success: false,
              error: `Failed to open ${data.editor}: process exited with code ${code}`,
            });
          }
        });

        childProcess.on("error", (error) => {
          serverLogger.error(`Error opening ${data.editor}:`, error);
          resolve({
            success: false,
            error: `Failed to open ${data.editor}: ${error.message}`,
          });
        });
      });
    } catch (error) {
      serverLogger.error("Error opening editor:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async listFiles(data: {
    repoPath?: string;
    environmentId?: Id<"environments">;
    branch?: string;
    pattern?: string;
  }) {
    try {
      const repoManager = RepositoryManager.getInstance();

      const ignoredPatterns = [
        "**/node_modules/**",
        "**/.git/**",
        "**/dist/**",
        "**/build/**",
        "**/.next/**",
        "**/coverage/**",
        "**/.turbo/**",
        "**/.vscode/**",
        "**/.idea/**",
        "**/tmp/**",
        "**/.DS_Store",
        "**/npm-debug.log*",
        "**/yarn-debug.log*",
        "**/yarn-error.log*",
      ];

      type FileInfo = {
        path: string;
        name: string;
        isDirectory: boolean;
        relativePath: string;
        repoFullName?: string;
      };

      async function walkDir(
        dir: string,
        baseDir: string,
      ): Promise<FileInfo[]> {
        const files: FileInfo[] = [];

        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(baseDir, fullPath);

            const shouldIgnore = ignoredPatterns.some(
              (ignorePattern) =>
                minimatch(relativePath, ignorePattern) ||
                minimatch(fullPath, ignorePattern),
            );

            if (shouldIgnore) continue;

            if (entry.isDirectory() && !data.pattern) {
              files.push({
                path: fullPath,
                name: entry.name,
                isDirectory: true,
                relativePath,
              });
            }

            if (entry.isDirectory()) {
              const subFiles = await walkDir(fullPath, baseDir);
              files.push(...subFiles);
            } else {
              files.push({
                path: fullPath,
                name: entry.name,
                isDirectory: false,
                relativePath,
              });
            }
          }
        } catch (error) {
          serverLogger.error(`Error reading directory ${dir}:`, error);
        }

        return files;
      }

      const listFilesForRepo = async ({
        targetRepoUrl,
        repoFullName,
        branchOverride,
      }: {
        targetRepoUrl: string;
        repoFullName?: string;
        branchOverride?: string;
      }): Promise<FileInfo[]> => {
        const projectPaths = await getProjectPaths(targetRepoUrl, this.teamSlugOrId);

        await fs.mkdir(projectPaths.projectPath, { recursive: true });
        await fs.mkdir(projectPaths.worktreesPath, { recursive: true });

        await repoManager.ensureRepository(
          targetRepoUrl,
          projectPaths.originPath,
        );

        const baseBranch =
          branchOverride ||
          (await repoManager.getDefaultBranch(projectPaths.originPath));

        await repoManager.ensureRepository(
          targetRepoUrl,
          projectPaths.originPath,
          baseBranch,
        );

        const worktreeInfo = {
          ...projectPaths,
          worktreePath: `${projectPaths.worktreesPath}/${baseBranch}`,
          branch: baseBranch,
        } as const;

        try {
          await fs.access(worktreeInfo.originPath);
        } catch {
          serverLogger.error(
            "Origin directory does not exist:",
            worktreeInfo.originPath,
          );
          return [];
        }

        let fileList = await walkDir(
          worktreeInfo.originPath,
          worktreeInfo.originPath,
        );

        if (data.pattern) {
          const filePaths = fileList.map((f) => f.relativePath);
          const results = fuzzysort.go(data.pattern, filePaths, {
            threshold: -10000,
            limit: 1000,
          });
          const fileMap = new Map(fileList.map((f) => [f.relativePath, f]));

          fileList = results
            .map((result) => fileMap.get(result.target)!)
            .filter(Boolean);
        } else {
          fileList.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.relativePath.localeCompare(b.relativePath);
          });
        }

        if (repoFullName) {
          return fileList.map((file) => ({
            ...file,
            repoFullName,
            relativePath: `${repoFullName}/${file.relativePath}`,
          }));
        }

        return fileList;
      };

      if (data.environmentId) {
        const environment = await getConvex().query(api.environments.get, {
          teamSlugOrId: this.teamSlugOrId,
          id: data.environmentId,
        });

        if (!environment) {
          return {
            files: [],
            error: "Environment not found",
          };
        }

        const repoFullNames = (environment.selectedRepos || [])
          .map((repo) => repo?.trim())
          .filter((repo): repo is string => Boolean(repo));

        if (repoFullNames.length === 0) {
          return {
            files: [],
            error: "This environment has no repositories configured",
          };
        }

        const aggregatedFiles: FileInfo[] = [];

        for (const repoFullName of repoFullNames) {
          try {
            const files = await listFilesForRepo({
              targetRepoUrl: `https://github.com/${repoFullName}.git`,
              repoFullName,
            });
            aggregatedFiles.push(...files);
          } catch (error) {
            serverLogger.error(
              `Failed to list files for environment repo ${repoFullName}:`,
              error,
            );
          }
        }

        return { files: aggregatedFiles };
      }

      if (data.repoPath) {
        const fileList = await listFilesForRepo({
          targetRepoUrl: data.repoPath,
          branchOverride: data.branch,
        });
        return { files: fileList };
      }

      return {
        files: [],
        error: "Repository information missing",
      };
    } catch (error) {
      serverLogger.error("Error listing files:", error);
      return {
        files: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async githubTestAuth() {
    try {
      const [authStatus, whoami, home, ghConfig] = await Promise.all([
        execWithEnv("gh auth status")
          .then((r) => r.stdout)
          .catch((e) => e.message),
        execWithEnv("whoami").then((r) => r.stdout),
        execWithEnv("echo $HOME").then((r) => r.stdout),
        execWithEnv('ls -la ~/.config/gh/ || echo "No gh config"').then(
          (r) => r.stdout,
        ),
      ]);

      return {
        authStatus,
        whoami,
        home,
        ghConfig,
        processEnv: {
          HOME: process.env.HOME,
          USER: process.env.USER,
          GH_TOKEN: process.env.GH_TOKEN ? "Set" : "Not set",
          GITHUB_TOKEN: process.env.GITHUB_TOKEN ? "Set" : "Not set",
        },
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        processEnv: {
          HOME: process.env.HOME,
          USER: process.env.USER,
          GH_TOKEN: process.env.GH_TOKEN ? "Set" : "Not set",
          GITHUB_TOKEN: process.env.GITHUB_TOKEN ? "Set" : "Not set",
        },
      };
    }
  }

  async githubFetchRepos(data: { teamSlugOrId: string }) {
    try {
      // First, try to get existing repos from Convex
      const existingRepos = await getConvex().query(api.github.getAllRepos, {
        teamSlugOrId: data.teamSlugOrId,
      });

      if (existingRepos.length > 0) {
        // If we have repos, return them and refresh in the background
        const reposByOrg = await getConvex().query(api.github.getReposByOrg, {
          teamSlugOrId: data.teamSlugOrId,
        });

        // Background refresh
        refreshGitHubData({ teamSlugOrId: data.teamSlugOrId }).catch((error) => {
          serverLogger.error("Background refresh failed:", error);
        });

        return { success: true, repos: reposByOrg };
      }

      // If no repos exist, do a full fetch
      await refreshGitHubData({ teamSlugOrId: data.teamSlugOrId });
      const reposByOrg = await getConvex().query(api.github.getReposByOrg, {
        teamSlugOrId: data.teamSlugOrId,
      });
      return { success: true, repos: reposByOrg };
    } catch (error) {
      serverLogger.error("Error fetching repos:", error);
      return {
        success: false,
        repos: {},
        error: `Failed to fetch GitHub repos: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  async spawnFromComment(data: {
    url: string;
    page: string;
    pageTitle: string;
    nodeId: string;
    x: number;
    y: number;
    content: string;
    userId: string;
    commentId: Id<"comments">;
    profileImageUrl?: string;
    selectedAgents?: string[];
    userAgent?: string;
    screenWidth?: number;
    screenHeight?: number;
    devicePixelRatio?: number;
  }) {
    try {
      // Format the prompt with comment metadata
      const formattedPrompt = `Fix the issue described in this comment:

Comment: "${data.content}"

Context:
- Page URL: ${data.url}${data.page}
- Page Title: ${data.pageTitle}
- Element XPath: ${data.nodeId}
- Position: ${data.x * 100}% x ${data.y * 100}% relative to element

Please address the issue mentioned in the comment above.`;

      // Create a new task in Convex
      const taskId = await getConvex().mutation(api.tasks.create, {
        teamSlugOrId: this.teamSlugOrId,
        text: formattedPrompt,
        projectFullName: "manaflow-ai/cmux",
      });

      // Create a comment reply with link to the task
      try {
        await getConvex().mutation(api.comments.addReply, {
          teamSlugOrId: this.teamSlugOrId,
          commentId: data.commentId,
          content: `[View run here](http://localhost:5173/${this.teamSlugOrId}/task/${taskId})`,
        });
        serverLogger.info("Created comment reply with task link:", {
          commentId: data.commentId,
          taskId,
        });
      } catch (replyError) {
        serverLogger.error("Failed to create comment reply:", replyError);
      }

      serverLogger.info("Created task from comment:", { taskId, content: data.content });

      // Spawn agents with the formatted prompt
      const agentResults = await spawnAllAgents(
        taskId,
        {
          repoUrl: "https://github.com/manaflow-ai/cmux.git",
          branch: "main",
          taskDescription: formattedPrompt,
          isCloudMode: true,
          theme: "dark",
          selectedAgents: data.selectedAgents || [
            "claude/sonnet-4",
            "codex/gpt-5",
          ],
        },
        this.teamSlugOrId,
      );

      const successfulAgents = agentResults.filter(
        (result) => result.success,
      );

      if (successfulAgents.length === 0) {
        const errors = agentResults
          .filter((r) => !r.success)
          .map((r) => `${r.agentName}: ${r.error || "Unknown error"}`)
          .join("; ");
        return {
          success: false,
          error: errors || "Failed to spawn any agents",
        };
      }

      const primaryAgent = successfulAgents[0];

      // Note: VSCode spawned broadcast is removed in RPC version

      return {
        success: true,
        taskId,
        taskRunId: primaryAgent.taskRunId,
        worktreePath: primaryAgent.worktreePath,
        terminalId: primaryAgent.terminalId,
        vscodeUrl: primaryAgent.vscodeUrl,
      };
    } catch (error) {
      serverLogger.error("Error spawning from comment:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async githubFetchBranches(data: {
    teamSlugOrId: string;
    repo: string;
  }) {
    try {
      const { listRemoteBranches } = await import("./native/git.js");
      const branches = await listRemoteBranches({ repoFullName: data.repo });
      return { success: true, branches: branches.map((b) => b.name) };
    } catch (error) {
      serverLogger.error("Error fetching branches:", error);
      return {
        success: false,
        branches: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async githubCreateDraftPr(data: { taskRunId: Id<"taskRuns"> }) {
    try {
      const run = await getConvex().query(api.taskRuns.get, {
        teamSlugOrId: this.teamSlugOrId,
        id: data.taskRunId,
      });
      if (!run) {
        return {
          success: false,
          results: [],
          aggregate: EMPTY_AGGREGATE,
          error: "Task run not found",
        };
      }

      const task = await getConvex().query(api.tasks.getById, {
        teamSlugOrId: this.teamSlugOrId,
        id: run.taskId,
      });
      if (!task) {
        return {
          success: false,
          results: [],
          aggregate: EMPTY_AGGREGATE,
          error: "Task not found",
        };
      }

      const branchName = run.newBranch?.trim();
      if (!branchName) {
        return {
          success: false,
          results: [],
          aggregate: EMPTY_AGGREGATE,
          error: "Missing branch name for run",
        };
      }

      const githubToken = await getGitHubTokenFromKeychain();
      if (!githubToken) {
        return {
          success: false,
          results: [],
          aggregate: EMPTY_AGGREGATE,
          error: "GitHub token is not configured",
        };
      }

      const repoFullNames = await collectRepoFullNamesForRun(
        run,
        task,
        this.teamSlugOrId,
      );
      if (repoFullNames.length === 0) {
        return {
          success: false,
          results: [],
          aggregate: EMPTY_AGGREGATE,
          error: "No repositories configured for this run",
        };
      }

      const baseBranch = task.baseBranch?.trim() || "main";
      const title = task.pullRequestTitle || task.text || "cmux changes";
      const truncatedTitle =
        title.length > 72 ? `${title.slice(0, 69)}...` : title;
      const body =
        task.text ||
        `## Summary

${title}`;

      const existingByRepo = new Map(
        (run.pullRequests ?? []).map(
          (record) => [record.repoFullName, record] as const,
        ),
      );

      const results = await Promise.all(
        repoFullNames.map(async (repoFullName) => {
          try {
            const split = splitRepoFullName(repoFullName);
            if (!split) {
              throw new Error(`Invalid repository name: ${repoFullName}`);
            }
            const { owner, repo } = split;
            const existingRecord = existingByRepo.get(repoFullName);
            const existingNumber = existingRecord?.number;

            let detail = await loadPullRequestDetail({
              token: githubToken,
              repoFullName,
              owner,
              repo,
              branchName,
              number: existingNumber,
            });

            if (!detail) {
              const created = await createDraftPr(
                githubToken,
                owner,
                repo,
                truncatedTitle,
                branchName,
                baseBranch,
                body,
              );
              detail =
                (await fetchPrDetail(
                  githubToken,
                  owner,
                  repo,
                  created.number,
                ).catch(() => null)) ??
                ({
                  ...created,
                  merged_at: null,
                } as Awaited<ReturnType<typeof fetchPrDetail>>);
            }

            return toPullRequestActionResult(repoFullName, detail);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            return {
              repoFullName,
              url: undefined,
              number: undefined,
              state: "none" as const,
              isDraft: undefined,
              error: message,
            };
          }
        }),
      );

      const persisted = await persistPullRequestResults({
        teamSlugOrId: this.teamSlugOrId,
        run,
        task,
        repoFullNames,
        results,
      });

      const errors = results
        .filter((result) => result.error)
        .map((result) => `${result.repoFullName}: ${result.error}`);

      return {
        success: errors.length === 0,
        results,
        aggregate: persisted.aggregate,
        error: errors.length > 0 ? errors.join("; ") : undefined,
      };
    } catch (error) {
      serverLogger.error("Error creating draft PR:", error);
      return {
        success: false,
        results: [],
        aggregate: EMPTY_AGGREGATE,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getAvailableEditors() {
    const execAsync = promisify(exec);
    
    const commandExists = async (cmd: string) => {
      try {
        await execAsync(`command -v ${cmd}`);
        return true;
      } catch {
        return false;
      }
    };

    const appExists = async (app: string) => {
      if (process.platform !== "darwin") return false;
      try {
        await execAsync(`open -Ra "${app}"`);
        return true;
      } catch {
        return false;
      }
    };

    const [
      vscodeExists,
      cursorExists,
      windsurfExists,
      itermExists,
      terminalExists,
      ghosttyCommand,
      ghosttyApp,
      alacrittyExists,
      xcodeExists,
    ] = await Promise.all([
      commandExists("code"),
      commandExists("cursor"),
      commandExists("windsurf"),
      appExists("iTerm"),
      appExists("Terminal"),
      commandExists("ghostty"),
      appExists("Ghostty"),
      commandExists("alacritty"),
      appExists("Xcode"),
    ]);

    return {
      vscode: vscodeExists,
      cursor: cursorExists,
      windsurf: windsurfExists,
      finder: process.platform === "darwin",
      iterm: itermExists,
      terminal: terminalExists,
      ghostty: ghosttyCommand || ghosttyApp,
      alacritty: alacrittyExists,
      xcode: xcodeExists,
    };
  }

  async checkProviderStatus() {
    try {
      const status = await checkAllProvidersStatus({
        teamSlugOrId: this.teamSlugOrId,
      });
      return { success: true, ...status };
    } catch (error) {
      serverLogger.error("Error checking provider status:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getDefaultRepo() {
    try {
      // Query Convex for repos for this team
      const reposByOrg = await getConvex().query(api.github.getReposByOrg, {
        teamSlugOrId: this.teamSlugOrId,
      });

      if (!reposByOrg) {
        return {};
      }

      // Get all repos across all orgs
      const allRepos = Object.values(reposByOrg as Record<string, Array<{ fullName: string; gitRemote?: string }>>)
        .flat();

      // If there's exactly one repo, return it as the default
      if (allRepos.length === 1) {
        const repo = allRepos[0];
        return {
          repoFullName: repo.fullName,
          localPath: repo.gitRemote || "",
        };
      }

      // Otherwise, no clear default
      return {};
    } catch (error) {
      serverLogger.error("Error getting default repo:", error);
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async archiveTask(data: { taskId: Id<"tasks"> }) {
    try {
      const results = await stopContainersForRuns(data.taskId, this.teamSlugOrId);

      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      if (failed > 0) {
        serverLogger.warn(
          `Archived task ${data.taskId}: ${successful} containers stopped, ${failed} failed`,
        );
      } else {
        serverLogger.info(
          `Successfully archived task ${data.taskId}: all ${successful} containers stopped`,
        );
      }

      return { success: true };
    } catch (error) {
      serverLogger.error("Error archiving task:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}