import { exec, execFile } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { promisify } from "util";
import {
  generatePreCommitHook,
  generatePrePushHook,
  type GitHooksConfig,
} from "./gitHooks.js";
import { serverLogger } from "./utils/fileLogger.js";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

interface RepositoryOperation {
  promise: Promise<void>;
  timestamp: number;
}

interface GitConfig {
  pullStrategy: "merge" | "rebase" | "ff-only";
  fetchDepth: number;
  operationCacheTime: number;
}

interface GitCommandOptions {
  cwd: string;
  encoding?: "utf8" | "ascii" | "base64" | "hex" | "binary" | "latin1";
  // When true, suppress logging for expected failures (e.g., existence checks)
  suppressErrorLogging?: boolean;
}

interface QueuedOperation {
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

export class RepositoryManager {
  private static instance: RepositoryManager;
  private operations = new Map<string, RepositoryOperation>();
  private worktreeLocks = new Map<string, Promise<void>>();
  private resolvedGitPath: string | null = null;

  // Global operation queue to prevent any git command conflicts
  private operationQueue: QueuedOperation[] = [];
  private isProcessingQueue = false;

  private config: GitConfig = {
    pullStrategy: "rebase",
    fetchDepth: 1,
    operationCacheTime: 5000, // 5 seconds
  };

  private constructor(config?: Partial<GitConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  static getInstance(config?: Partial<GitConfig>): RepositoryManager {
    if (!RepositoryManager.instance) {
      RepositoryManager.instance = new RepositoryManager(config);
    }
    return RepositoryManager.instance;
  }

  private getCacheKey(repoUrl: string, operation: string): string {
    // Include the operation details (which may embed paths/branches) to avoid
    // accidental cross-repo or cross-directory reuse. This method is kept for
    // consistency should we later want to normalize keys.
    return `${repoUrl}:${operation}`;
  }

  private cleanupStaleOperations(): void {
    const now = Date.now();
    for (const [key, op] of this.operations) {
      if (now - op.timestamp > this.config.operationCacheTime) {
        this.operations.delete(key);
      }
    }
  }

  private async queueOperation<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.operationQueue.push({
        execute: operation,
        resolve,
        reject,
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.operationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.operationQueue.length > 0) {
      const operation = this.operationQueue.shift()!;
      try {
        const result = await operation.execute();
        operation.resolve(result);
      } catch (error) {
        operation.reject(error);
      }
    }

    this.isProcessingQueue = false;
  }

  // Note: Keep all git invocations using executeGitCommand with a shell, as some CI envs lack direct execFile PATH resolution.

  async executeGitCommand(
    command: string,
    options?: GitCommandOptions
  ): Promise<{ stdout: string; stderr: string }> {
    // Commands that modify git config, create worktrees, or clone should be serialized
    const needsQueue =
      command.includes("git config") ||
      command.includes("git worktree add") ||
      command.includes("git clone");

    if (needsQueue) {
      return this.queueOperation(async () => {
        try {
          const result = await execAsync(command, {
            shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
            ...options,
          });
          return {
            stdout: result.stdout.toString(),
            stderr: result.stderr.toString(),
          };
        } catch (error) {
          // Log only if not suppressed (some failures are expected)
          if (!options?.suppressErrorLogging) {
            serverLogger.error(`Git command failed: ${command}`);
            if (error instanceof Error) {
              serverLogger.error(`Error: ${error.message}`);
              if ("stderr" in error && (error as any).stderr) {
                serverLogger.error(`Stderr: ${(error as any).stderr}`);
              }
            }
          }
          throw error;
        }
      });
    }

    // Prefer execFile with an absolute git path when invoking non-queued git commands
    if (command.startsWith("git ")) {
      const gitPath = await this.getGitPath();
      const args = this.tokenizeGitArgs(command.slice(4));
      try {
        const result = await execFileAsync(gitPath, args, {
          cwd: options?.cwd,
          encoding: options?.encoding ?? "utf8",
          windowsHide: true,
        } as any);
        return {
          stdout: result.stdout.toString(),
          stderr: result.stderr?.toString?.() || "",
        };
      } catch (error) {
        // Log and fall through to shell execution unless suppressed
        if (!options?.suppressErrorLogging) {
          serverLogger.error(
            `Git command failed: ${gitPath} ${args.join(" ")}`
          );
          if (error instanceof Error) {
            serverLogger.error(`Error: ${error.message}`);
            if ((error as any).stderr) {
              serverLogger.error(`Stderr: ${(error as any).stderr}`);
            }
          }
        }
      }
    }

    // Non-conflicting commands can run immediately via shell
    try {
      const result = await execAsync(command, {
        shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
        ...options,
      });
      return {
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString(),
      };
    } catch (error) {
      // Log only if not suppressed
      if (!options?.suppressErrorLogging) {
        serverLogger.error(`Git command failed: ${command}`);
        if (error instanceof Error) {
          serverLogger.error(`Error: ${error.message}`);
          if ("stderr" in error && (error as any).stderr) {
            serverLogger.error(`Stderr: ${(error as any).stderr}`);
          }
        }
      }
      throw error;
    }
  }

  // Remove a stale git lock file (e.g., shallow.lock or index.lock) if it looks abandoned.
  // This is a safety valve for cases where a previous git process crashed and left a lock behind.
  private async removeStaleGitLock(
    repoPath: string,
    relLockPath: string,
    maxAgeMs: number = 60_000,
    force: boolean = false
  ): Promise<boolean> {
    try {
      const lockPath = path.join(repoPath, ".git", relLockPath);
      const stat = await fs.stat(lockPath).catch(() => null);
      if (!stat) return false;
      const age = Date.now() - stat.mtimeMs;
      if (force || age > maxAgeMs) {
        await fs.rm(lockPath, { force: true });
        serverLogger.warn(
          `Removed ${relLockPath} at ${lockPath} (age=${Math.round(age)}ms, force=${force})`
        );
        return true;
      }
      // Too new; leave it for the other process to complete
      serverLogger.info(
        `${relLockPath} exists but is recent (${Math.round(age)}ms); not removing`
      );
      return false;
    } catch (e) {
      serverLogger.warn(`Failed removing stale lock ${relLockPath}:`, e);
      return false;
    }
  }

  private async getGitPath(): Promise<string> {
    if (this.resolvedGitPath) return this.resolvedGitPath;
    const candidates = [
      process.env.GIT_PATH,
      process.platform === "win32" ? "git.exe" : undefined,
      "/opt/homebrew/bin/git",
      "/usr/local/bin/git",
      "/usr/bin/git",
      "/bin/git",
      "git",
    ].filter(Boolean) as string[];

    for (const p of candidates) {
      try {
        await fs.access(p);
        this.resolvedGitPath = p;
        return p;
      } catch {
        // try next
      }
    }
    // Last resort
    this.resolvedGitPath = process.platform === "win32" ? "git.exe" : "git";
    return this.resolvedGitPath;
  }

  private tokenizeGitArgs(s: string): string[] {
    const args: string[] = [];
    const re = /\s*("([^"]*)"|'([^']*)'|[^\s"']+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      args.push(m[2] ?? m[3] ?? m[1]);
    }
    return args;
  }

  private async configureGitPullStrategy(repoPath: string): Promise<void> {
    const strategy =
      this.config.pullStrategy === "ff-only"
        ? "only"
        : this.config.pullStrategy;
    const cmd = `git config pull.${
      this.config.pullStrategy === "ff-only" ? "ff" : this.config.pullStrategy
    } ${strategy === "only" ? "only" : "true"}`;

    // Retry a few times to avoid transient .git/config lock contention
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.executeGitCommand(cmd, { cwd: repoPath });
        return;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const isLock = msg.includes("could not lock config file");
        if (attempt < maxAttempts && isLock) {
          await new Promise((r) => setTimeout(r, 100 * attempt));
          continue;
        }
        serverLogger.warn("Failed to configure git pull strategy:", error);
        return;
      }
    }
  }

  async ensureRepository(
    repoUrl: string,
    originPath: string,
    branch?: string
  ): Promise<void> {
    this.cleanupStaleOperations();

    // Check if repo exists
    const repoExists = await this.checkIfRepoExists(originPath);

    if (!repoExists) {
      await this.handleCloneOperation(repoUrl, originPath);
      // After cloning, set the remote HEAD reference
      try {
        await this.executeGitCommand(`git remote set-head origin -a`, {
          cwd: originPath,
        });
      } catch (error) {
        serverLogger.warn("Failed to set remote HEAD after clone:", error);
      }
    } else {
      // Configure git pull strategy for existing repos
      await this.configureGitPullStrategy(originPath);
      // Ensure a usable remote named 'origin' exists and points to repoUrl
      await this.ensureRemoteOrigin(originPath, repoUrl);
    }

    // If no branch specified, detect the default branch
    let targetBranch = branch;
    if (!targetBranch) {
      targetBranch = await this.getDefaultBranch(originPath);
      serverLogger.info(`Detected default branch: ${targetBranch}`);
    }

    // Only fetch if a specific branch was requested or if we detected a branch
    if (targetBranch) {
      await this.handleFetchOperation(repoUrl, originPath, targetBranch);
    }
  }

  private async ensureRemoteOrigin(
    repoPath: string,
    repoUrl: string
  ): Promise<void> {
    try {
      // Check if 'origin' remote exists
      const { stdout } = await this.executeGitCommand(
        `git remote get-url origin`,
        { cwd: repoPath }
      );
      const currentUrl = stdout.trim();
      if (!currentUrl) {
        // Add 'origin' if missing
        await this.executeGitCommand(`git remote add origin "${repoUrl}"`, {
          cwd: repoPath,
        });
      } else if (currentUrl !== repoUrl) {
        // Keep remote up to date with expected URL
        await this.executeGitCommand(`git remote set-url origin "${repoUrl}"`, {
          cwd: repoPath,
        });
      }
    } catch (e) {
      // If 'origin' does not exist, add it
      await this.executeGitCommand(`git remote add origin "${repoUrl}"`, {
        cwd: repoPath,
      });
    }

    // Best-effort: set remote HEAD so default branch detection works
    try {
      await this.executeGitCommand(`git remote set-head origin -a`, {
        cwd: repoPath,
      });
    } catch (err) {
      serverLogger.warn(
        `Failed to set remote HEAD for origin at ${repoPath}: ${String(err)}`
      );
    }
  }

  private async handleCloneOperation(
    repoUrl: string,
    originPath: string
  ): Promise<void> {
    // Key the clone operation by both repo URL and destination path to avoid
    // reusing a clone into a different directory, which can cause ENOENT when
    // subsequent commands run in a non-existent cwd.
    const cloneKey = this.getCacheKey(repoUrl, `clone:${originPath}`);
    const existingClone = this.operations.get(cloneKey);

    if (
      existingClone &&
      Date.now() - existingClone.timestamp < this.config.operationCacheTime
    ) {
      serverLogger.info(`Reusing existing clone operation for ${repoUrl}`);
      await existingClone.promise.catch(() => {
        /* swallow to allow retry below */
      });
      // After the in-flight operation completes, remove it so the next call can proceed freshly
      this.operations.delete(cloneKey);
    } else {
      const clonePromise = this.cloneRepository(repoUrl, originPath);
      this.operations.set(cloneKey, {
        promise: clonePromise,
        timestamp: Date.now(),
      });
      try {
        await clonePromise;
      } finally {
        // Remove entry so subsequent operations aren't skipped
        this.operations.delete(cloneKey);
      }
    }
  }

  private async handleFetchOperation(
    repoUrl: string,
    originPath: string,
    branch: string
  ): Promise<void> {
    // Similarly, key fetch operations by branch and destination path so that
    // concurrent clones of the same repo in different origins don't conflict.
    const fetchKey = this.getCacheKey(repoUrl, `fetch:${branch}:${originPath}`);
    const existingFetch = this.operations.get(fetchKey);

    if (
      existingFetch &&
      Date.now() - existingFetch.timestamp < this.config.operationCacheTime
    ) {
      serverLogger.info(
        `Reusing existing fetch operation for ${repoUrl} branch ${branch}`
      );
      await existingFetch.promise.catch(() => {
        /* swallow to allow retry below */
      });
      // Remove completed entry to allow a fresh fetch
      this.operations.delete(fetchKey);
    } else {
      const fetchPromise = this.fetchAndCheckoutBranch(originPath, branch);
      this.operations.set(fetchKey, {
        promise: fetchPromise,
        timestamp: Date.now(),
      });
      try {
        await fetchPromise;
      } finally {
        // Ensure the operation does not block subsequent real fetches
        this.operations.delete(fetchKey);
      }
    }
  }

  private async checkIfRepoExists(repoPath: string): Promise<boolean> {
    try {
      await fs.access(path.join(repoPath, ".git"));
      return true;
    } catch {
      return false;
    }
  }

  private async cloneRepository(
    repoUrl: string,
    originPath: string
  ): Promise<void> {
    serverLogger.info(
      `Cloning repository ${repoUrl} with depth ${this.config.fetchDepth}...`
    );
    try {
      await this.executeGitCommand(
        `git clone --depth ${this.config.fetchDepth} "${repoUrl}" "${originPath}"`
      );
      serverLogger.info(`Successfully cloned ${repoUrl}`);

      // Set the remote HEAD reference explicitly
      try {
        await this.executeGitCommand(`git remote set-head origin -a`, {
          cwd: originPath,
        });
      } catch (error) {
        serverLogger.warn("Failed to set remote HEAD reference:", error);
      }

      // Configure git pull strategy for the newly cloned repo
      await this.configureGitPullStrategy(originPath);

      // Set up git hooks
      await this.setupGitHooks(originPath);
    } catch (error) {
      serverLogger.error(`Failed to clone ${repoUrl}:`, error);
      throw error;
    }
  }

  async getCurrentBranch(repoPath: string): Promise<string> {
    const { stdout } = await this.executeGitCommand(
      `git rev-parse --abbrev-ref HEAD`,
      { cwd: repoPath, encoding: "utf8" }
    );
    return stdout.trim();
  }

  async getDefaultBranch(repoPath: string): Promise<string> {
    try {
      // Try to get the default branch from the remote
      const { stdout } = await this.executeGitCommand(
        `git symbolic-ref refs/remotes/origin/HEAD`,
        { cwd: repoPath, encoding: "utf8" }
      );
      // Extract branch name from refs/remotes/origin/main format
      const match = stdout.trim().match(/refs\/remotes\/origin\/(.+)$/);
      return match ? match[1] : "main";
    } catch (_error) {
      // If that fails, try to get it from the remote
      try {
        const { stdout } = await this.executeGitCommand(
          `git ls-remote --symref origin HEAD`,
          { cwd: repoPath, encoding: "utf8" }
        );
        // Extract branch name from ref: refs/heads/main format
        const match = stdout.match(/ref: refs\/heads\/(\S+)\s+HEAD/);
        if (match) {
          return match[1];
        }
      } catch {
        // Fallback to common defaults
        serverLogger.warn(
          "Could not determine default branch, trying common names"
        );
      }

      // Try common default branch names
      const commonDefaults = ["main", "master", "dev", "develop"];
      for (const branch of commonDefaults) {
        try {
          await this.executeGitCommand(
            `git rev-parse --verify origin/${branch}`,
            { cwd: repoPath, encoding: "utf8", suppressErrorLogging: true }
          );
          return branch;
        } catch {
          // Continue to next branch
        }
      }

      // Final fallback
      return "main";
    }
  }

  private async pullLatestChanges(
    repoPath: string,
    branch: string
  ): Promise<void> {
    const pullFlags =
      this.config.pullStrategy === "rebase"
        ? "--rebase"
        : this.config.pullStrategy === "ff-only"
          ? "--ff-only"
          : "";

    try {
      // Clear any stale shallow.lock before invoking a pull (pull may fetch)
      await this.removeStaleGitLock(repoPath, "shallow.lock", 15_000);
      await this.executeGitCommand(
        `git pull ${pullFlags} --depth ${this.config.fetchDepth} origin ${branch}`,
        { cwd: repoPath }
      );
      serverLogger.info(`Successfully pulled latest changes for ${branch}`);
    } catch (error) {
      // If pull fails due to conflicts, divergent or unrelated histories, try to recover
      if (
        error instanceof Error &&
        (error.message.includes("divergent branches") ||
          error.message.includes("conflict") ||
          error.message.includes("unrelated histories"))
      ) {
        serverLogger.warn(
          `Pull failed (likely conflicts/divergence). Attempting hard reset to origin/${branch}`
        );
        try {
          // Fetch the latest state
          await this.removeStaleGitLock(repoPath, "shallow.lock", 15_000);
          await this.executeGitCommand(
            `git fetch --depth ${this.config.fetchDepth} origin ${branch}`,
            { cwd: repoPath }
          );
          // Reset to the remote branch
          await this.executeGitCommand(`git reset --hard origin/${branch}`, {
            cwd: repoPath,
          });
          serverLogger.info(`Successfully reset to origin/${branch}`);
        } catch (resetError) {
          serverLogger.error(
            `Failed to reset to origin/${branch}:`,
            resetError
          );
          throw resetError;
        }
      } else {
        throw error;
      }
    }
  }

  private async fetchAndCheckoutBranch(
    originPath: string,
    branch: string
  ): Promise<void> {
    serverLogger.info(`Fetching and checking out branch ${branch}...`);
    try {
      // Always fetch and checkout explicitly to reduce reliance on shell availability for rev-parse
      await this.switchToBranch(originPath, branch);
      // Then pull latest changes for safety (fast and idempotent)
      await this.pullLatestChanges(originPath, branch);
      serverLogger.info(`Successfully on branch ${branch}`);
    } catch (error) {
      serverLogger.error(`Failed to fetch/checkout branch ${branch}:`, error);
      // Propagate error so callers can surface it to users
      throw error;
    }
  }

  private async switchToBranch(
    repoPath: string,
    branch: string
  ): Promise<void> {
    // Fetch the specific branch and explicitly update the remote-tracking ref
    // even if the clone was created with --single-branch.
    // Force-update the remote-tracking ref to tolerate non-fast-forward updates
    // (e.g., when the remote branch was force-pushed). Using a leading '+'
    // mirrors the default fetch refspec behavior: +refs/heads/*:refs/remotes/origin/*
    const fetchCmd = `git fetch --depth ${this.config.fetchDepth} origin +refs/heads/${branch}:refs/remotes/origin/${branch}`;
    // First, proactively clear stale shallow.lock if present (older than 15s)
    await this.removeStaleGitLock(repoPath, "shallow.lock", 15_000);
    try {
      await this.executeGitCommand(fetchCmd, { cwd: repoPath });
    } catch (e) {
      const msg = e instanceof Error ? `${e.message}\n${e || ""}` : String(e);
      const lockHit =
        msg.includes("shallow.lock") ||
        msg.includes("could not lock shallow") ||
        msg.includes("Another git process seems to be running");
      if (lockHit) {
        // Force-remove lock and retry with small backoff
        await this.removeStaleGitLock(repoPath, "shallow.lock", 0, true);
        await new Promise((r) => setTimeout(r, 150));
        await this.executeGitCommand(fetchCmd, { cwd: repoPath });
      } else {
        throw e;
      }
    }

    // Checkout the branch from the updated remote-tracking ref
    await this.executeGitCommand(`git checkout -B ${branch} origin/${branch}`, {
      cwd: repoPath,
    });
  }

  async worktreeExists(
    originPath: string,
    worktreePath: string
  ): Promise<boolean> {
    try {
      const { stdout } = await this.executeGitCommand(
        `git worktree list --porcelain`,
        { cwd: originPath }
      );
      // Check if the worktree path exists in the list
      return stdout.includes(worktreePath);
    } catch {
      return false;
    }
  }

  async removeWorktree(
    originPath: string,
    worktreePath: string
  ): Promise<void> {
    try {
      await this.executeGitCommand(
        `git worktree remove "${worktreePath}" --force`,
        { cwd: originPath }
      );
      serverLogger.info(`Removed worktree at ${worktreePath}`);
    } catch (error) {
      serverLogger.warn(`Failed to remove worktree at ${worktreePath}:`, error);
    }
  }

  async findWorktreeUsingBranch(
    originPath: string,
    branchName: string
  ): Promise<string | null> {
    try {
      const { stdout } = await this.executeGitCommand(
        `git worktree list --porcelain`,
        { cwd: originPath }
      );

      // Parse worktree list to find which worktree uses this branch
      const lines = stdout.split("\n");
      let currentWorktreePath: string | null = null;

      for (const line of lines) {
        if (line.startsWith("worktree ")) {
          currentWorktreePath = line.substring(9); // Remove 'worktree ' prefix
        } else if (
          line.startsWith("branch refs/heads/") &&
          currentWorktreePath
        ) {
          const branch = line.substring(18); // Remove 'branch refs/heads/' prefix
          if (branch === branchName) {
            return currentWorktreePath;
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  async createWorktree(
    originPath: string,
    worktreePath: string,
    branchName: string,
    baseBranch: string = "main"
  ): Promise<string> {
    // In-process lock keyed by repo+branch to avoid concurrent add for same branch
    const inProcessLockKey = `${originPath}::${branchName}`;
    const existingLock = this.worktreeLocks.get(inProcessLockKey);
    if (existingLock) {
      serverLogger.info(
        `Waiting for existing worktree operation on ${originPath} (${branchName})...`
      );
      await existingLock;
    }

    let releaseInProcessLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseInProcessLock = () => {
        this.worktreeLocks.delete(inProcessLockKey);
        resolve();
      };
    });
    this.worktreeLocks.set(inProcessLockKey, lockPromise);

    serverLogger.info(`Creating worktree with branch ${branchName}...`);
    try {
      // If the branch is already attached to a worktree, reuse that path to avoid duplicates
      const preexistingPath = await this.findWorktreeUsingBranch(
        originPath,
        branchName
      );
      if (preexistingPath) {
        if (preexistingPath !== worktreePath) {
          serverLogger.info(
            `Branch ${branchName} is attached to ${preexistingPath}; moving to ${worktreePath}`
          );
          try {
            await this.removeWorktree(originPath, preexistingPath);
          } catch (e) {
            serverLogger.warn(
              `Failed to remove old worktree ${preexistingPath} for ${branchName}:`,
              e
            );
          }
          try {
            await fs.rm(preexistingPath, { recursive: true, force: true });
          } catch {
            // ignore
          }
        } else {
          serverLogger.info(
            `Branch ${branchName} already attached to worktree at ${preexistingPath}; reusing`
          );
          // Best-effort ensure branch tracking + hooks
          await this.ensureWorktreeConfigured(preexistingPath, branchName);
          return preexistingPath;
        }
      }
      // First check if the branch is already used by another worktree
      const existingWorktreePath = await this.findWorktreeUsingBranch(
        originPath,
        branchName
      );
      if (existingWorktreePath && existingWorktreePath !== worktreePath) {
        // Another process may have just created it while we were waiting on lock
        // Align with requested path by removing the other worktree and creating ours
        serverLogger.info(
          `Branch ${branchName} attached at ${existingWorktreePath}; replacing with ${worktreePath}`
        );
        try {
          await this.removeWorktree(originPath, existingWorktreePath);
        } catch (e) {
          serverLogger.warn(
            `Failed to remove concurrent worktree ${existingWorktreePath}:`,
            e
          );
        }
        try {
          await fs.rm(existingWorktreePath, { recursive: true, force: true });
        } catch {
          // Do not block the other worktree from being created
        }
      }

      // Check if the branch already exists
      let branchExists = false;
      try {
        await this.executeGitCommand(
          `git rev-parse --verify refs/heads/${branchName}`,
          { cwd: originPath, suppressErrorLogging: true }
        );
        branchExists = true;
      } catch {
        // Branch doesn't exist, which is fine
      }

      if (branchExists) {
        // Branch exists. If the intended worktree path already exists/registered,
        // treat this as a no-op and proceed to configure.
        const alreadyRegistered = await this.worktreeExists(
          originPath,
          worktreePath
        );
        if (alreadyRegistered) {
          serverLogger.info(
            `Worktree for ${branchName} already exists at ${worktreePath}; skipping add`
          );
        } else {
          // Create worktree without -b flag
          serverLogger.info(
            `Branch ${branchName} already exists, creating worktree without new branch`
          );
          await this.executeGitCommand(
            `git worktree add "${worktreePath}" ${branchName}`,
            { cwd: originPath }
          );
        }
      } else {
        // Branch doesn't exist, create it with the worktree
        await this.executeGitCommand(
          `git worktree add -b "${branchName}" "${worktreePath}" origin/${baseBranch}`,
          { cwd: originPath }
        );
      }
      serverLogger.info(`Successfully created worktree at ${worktreePath}`);

      // Set up branch configuration to push to the same name on remote
      // Use a serial approach for config commands to avoid lock conflicts
      await this.configureWorktreeBranch(worktreePath, branchName);

      // Set up git hooks in the worktree
      await this.setupGitHooks(worktreePath);
      return worktreePath;
    } catch (error) {
      // If another process just created the worktree, treat as success.
      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        const alreadyExists =
          msg.includes("already exists") ||
          msg.includes("is already checked out") ||
          (msg.includes("worktree add") && msg.includes("file exists"));
        if (alreadyExists) {
          // Re-verify actual worktree location for this branch and reuse it
          const actualPath =
            (await this.findWorktreeUsingBranch(originPath, branchName)) ||
            worktreePath;
          serverLogger.info(
            `Worktree already present at ${actualPath}; ensuring configuration`
          );
          try {
            await this.ensureWorktreeConfigured(actualPath, branchName);
          } catch (e) {
            serverLogger.warn(
              `Post-existence configuration failed for ${actualPath}:`,
              e
            );
          }
          return actualPath;
        }
      }
      // Provide a clearer error message when the base branch does not exist
      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (
          msg.includes("invalid reference") ||
          msg.includes("couldn't find remote ref") ||
          msg.includes("not a valid object name") ||
          msg.includes("fatal: invalid reference")
        ) {
          throw new Error(
            `Base branch 'origin/${baseBranch}' not found. Please select an existing branch.`
          );
        }
      }
      throw error;
    } finally {
      releaseInProcessLock!();
    }
  }

  private async configureWorktreeBranch(
    worktreePath: string,
    branchName: string
  ): Promise<void> {
    try {
      await this.executeGitCommand(
        `git config branch.${branchName}.remote origin`,
        { cwd: worktreePath }
      );
      await this.executeGitCommand(
        `git config branch.${branchName}.merge refs/heads/${branchName}`,
        { cwd: worktreePath }
      );

      // Configure VS Code git extension to show diffs from main branch
      await this.executeGitCommand(
        `git config vscode.gitSCM.defaultViewMode tree`,
        { cwd: worktreePath }
      );
      await this.executeGitCommand(
        `git config vscode.gitSCM.showChangesSinceLastPublish true`,
        { cwd: worktreePath }
      );
      // Set main as the base branch for comparisons
      await this.executeGitCommand(`git config diff.base main`, {
        cwd: worktreePath,
      });
      await this.executeGitCommand(`git config merge.base main`, {
        cwd: worktreePath,
      });

      serverLogger.info(
        `Configured branch ${branchName} to track origin/${branchName} when pushed and show diffs from main`
      );
    } catch (error) {
      serverLogger.warn(
        `Failed to configure branch tracking for ${branchName}:`,
        error
      );
    }
  }

  // Method to update configuration at runtime
  updateConfig(config: Partial<GitConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Public helper to ensure a worktree has proper branch tracking and hooks
  async ensureWorktreeConfigured(
    worktreePath: string,
    branchName: string
  ): Promise<void> {
    await this.configureWorktreeBranch(worktreePath, branchName);
    await this.setupGitHooks(worktreePath);
  }

  private async setupGitHooks(repoPath: string): Promise<void> {
    try {
      // Determine if this is a worktree or main repository
      const gitDir = path.join(repoPath, ".git");
      const gitDirStat = await fs.stat(gitDir);

      let hooksDir: string;
      if (gitDirStat.isDirectory()) {
        // Regular repository
        hooksDir = path.join(gitDir, "hooks");
      } else {
        // Worktree - read the .git file to find the actual git directory
        const gitFileContent = await fs.readFile(gitDir, "utf8");
        const match = gitFileContent.match(/gitdir: (.+)/);
        if (!match) {
          serverLogger.warn(`Could not parse .git file in ${repoPath}`);
          return;
        }
        const actualGitDir = match[1].trim();
        // For worktrees, hooks are in the common git directory
        const commonDir = path.join(path.dirname(actualGitDir), "commondir");
        try {
          const commonDirContent = await fs.readFile(commonDir, "utf8");
          const commonPath = commonDirContent.trim();
          // If commondir is relative, resolve it from the worktree git directory
          const resolvedCommonPath = path.isAbsolute(commonPath)
            ? commonPath
            : path.resolve(path.dirname(actualGitDir), commonPath);
          hooksDir = path.join(resolvedCommonPath, "hooks");
        } catch {
          // Fallback to the hooks in the worktree's git directory
          hooksDir = path.join(actualGitDir, "hooks");
        }
      }

      // Create hooks directory if it doesn't exist
      await fs.mkdir(hooksDir, { recursive: true });

      // Configure hooks
      const hooksConfig: GitHooksConfig = {
        protectedBranches: [
          "main",
          "master",
          "develop",
          "production",
          "staging",
        ],
        allowForcePush: false,
        allowBranchDeletion: false,
      };

      // Write pre-push hook
      const prePushPath = path.join(hooksDir, "pre-push");
      await fs.writeFile(prePushPath, generatePrePushHook(hooksConfig), {
        mode: 0o755,
      });
      serverLogger.info(`Created pre-push hook at ${prePushPath}`);

      // Write pre-commit hook
      const preCommitPath = path.join(hooksDir, "pre-commit");
      await fs.writeFile(preCommitPath, generatePreCommitHook(hooksConfig), {
        mode: 0o755,
      });
      serverLogger.info(`Created pre-commit hook at ${preCommitPath}`);
    } catch (error) {
      serverLogger.warn(`Failed to set up git hooks in ${repoPath}:`, error);
      // Don't throw - hooks are nice to have but not critical
    }
  }
}
