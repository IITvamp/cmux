import { exec } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { promisify } from "util";
import { generatePrePushHook, generatePreCommitHook, type GitHooksConfig } from "./gitHooks.js";

const execAsync = promisify(exec);

interface RepositoryOperation {
  promise: Promise<void>;
  timestamp: number;
}

interface GitConfig {
  pullStrategy: 'merge' | 'rebase' | 'ff-only';
  fetchDepth: number;
  operationCacheTime: number;
}

interface GitCommandOptions {
  cwd: string;
  encoding?: BufferEncoding;
}

export class RepositoryManager {
  private static instance: RepositoryManager;
  private operations = new Map<string, RepositoryOperation>();
  private worktreeLocks = new Map<string, Promise<void>>();
  
  private config: GitConfig = {
    pullStrategy: 'rebase',
    fetchDepth: 1,
    operationCacheTime: 5000 // 5 seconds
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
    return `${repoUrl}:${operation}`;
  }

  private cleanupStaleOperations(): void {
    const now = Date.now();
    const entries = Array.from(this.operations.entries());
    for (const [key, op] of entries) {
      if (now - op.timestamp > this.config.operationCacheTime) {
        this.operations.delete(key);
      }
    }
  }

  private async executeGitCommand(command: string, options?: GitCommandOptions): Promise<{ stdout: string; stderr: string }> {
    try {
      const result = await execAsync(command, options);
      return {
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString()
      };
    } catch (error) {
      // Log the command that failed for debugging
      console.error(`Git command failed: ${command}`);
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
        if ('stderr' in error && error.stderr) {
          console.error(`Stderr: ${error.stderr}`);
        }
      }
      throw error;
    }
  }

  private async configureGitPullStrategy(repoPath: string): Promise<void> {
    try {
      const strategy = this.config.pullStrategy === 'ff-only' ? 'only' : this.config.pullStrategy;
      await this.executeGitCommand(
        `git config pull.${this.config.pullStrategy === 'ff-only' ? 'ff' : this.config.pullStrategy} ${strategy === 'only' ? 'only' : 'true'}`,
        { cwd: repoPath }
      );
    } catch (error) {
      console.warn("Failed to configure git pull strategy:", error);
    }
  }

  async ensureRepository(repoUrl: string, originPath: string, branch: string = "main"): Promise<void> {
    this.cleanupStaleOperations();

    // Check if repo exists
    const repoExists = await this.checkIfRepoExists(originPath);

    if (!repoExists) {
      await this.handleCloneOperation(repoUrl, originPath);
    } else {
      // Configure git pull strategy for existing repos
      await this.configureGitPullStrategy(originPath);
    }
    
    // Always fetch and checkout the requested branch
    await this.handleFetchOperation(repoUrl, originPath, branch);
  }

  private async handleCloneOperation(repoUrl: string, originPath: string): Promise<void> {
    const cloneKey = this.getCacheKey(repoUrl, "clone");
    const existingClone = this.operations.get(cloneKey);
    
    if (existingClone && Date.now() - existingClone.timestamp < this.config.operationCacheTime) {
      console.log(`Reusing existing clone operation for ${repoUrl}`);
      await existingClone.promise;
    } else {
      const clonePromise = this.cloneRepository(repoUrl, originPath);
      this.operations.set(cloneKey, {
        promise: clonePromise,
        timestamp: Date.now(),
      });

      await clonePromise;
    }
  }

  private async handleFetchOperation(repoUrl: string, originPath: string, branch: string): Promise<void> {
    const fetchKey = this.getCacheKey(repoUrl, `fetch:${branch}`);
    const existingFetch = this.operations.get(fetchKey);
    
    if (existingFetch && Date.now() - existingFetch.timestamp < this.config.operationCacheTime) {
      console.log(`Reusing existing fetch operation for ${repoUrl} branch ${branch}`);
      await existingFetch.promise;
    } else {
      const fetchPromise = this.fetchAndCheckoutBranch(originPath, branch);
      this.operations.set(fetchKey, {
        promise: fetchPromise,
        timestamp: Date.now(),
      });

      await fetchPromise;
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

  private async cloneRepository(repoUrl: string, originPath: string): Promise<void> {
    console.log(`Cloning repository ${repoUrl} with depth ${this.config.fetchDepth}...`);
    try {
      await this.executeGitCommand(
        `git clone --depth ${this.config.fetchDepth} "${repoUrl}" "${originPath}"`
      );
      console.log(`Successfully cloned ${repoUrl}`);
      
      // Configure git pull strategy for the newly cloned repo
      await this.configureGitPullStrategy(originPath);
      
      // Set up git hooks
      await this.setupGitHooks(originPath);
    } catch (error) {
      console.error(`Failed to clone ${repoUrl}:`, error);
      throw error;
    }
  }

  private async getCurrentBranch(repoPath: string): Promise<string> {
    const { stdout } = await this.executeGitCommand(
      `git rev-parse --abbrev-ref HEAD`,
      { cwd: repoPath, encoding: 'utf8' }
    );
    return stdout.trim();
  }

  private async pullLatestChanges(repoPath: string, branch: string): Promise<void> {
    const pullFlags = this.config.pullStrategy === 'rebase' ? '--rebase' : 
                     this.config.pullStrategy === 'ff-only' ? '--ff-only' : '';
    
    try {
      await this.executeGitCommand(
        `git pull ${pullFlags} --depth ${this.config.fetchDepth} origin ${branch}`,
        { cwd: repoPath }
      );
      console.log(`Successfully pulled latest changes for ${branch}`);
    } catch (error) {
      // If pull fails due to conflicts or divergent branches, try to recover
      if (error instanceof Error && (error.message.includes('divergent branches') || error.message.includes('conflict'))) {
        console.warn(`Pull failed due to conflicts, attempting to reset to origin/${branch}`);
        try {
          // Fetch the latest state
          await this.executeGitCommand(
            `git fetch --depth ${this.config.fetchDepth} origin ${branch}`,
            { cwd: repoPath }
          );
          // Reset to the remote branch
          await this.executeGitCommand(
            `git reset --hard origin/${branch}`,
            { cwd: repoPath }
          );
          console.log(`Successfully reset to origin/${branch}`);
        } catch (resetError) {
          console.error(`Failed to reset to origin/${branch}:`, resetError);
          throw resetError;
        }
      } else {
        throw error;
      }
    }
  }

  private async fetchAndCheckoutBranch(originPath: string, branch: string): Promise<void> {
    console.log(`Fetching and checking out branch ${branch}...`);
    try {
      const currentBranch = await this.getCurrentBranch(originPath);
      
      if (currentBranch === branch) {
        // Already on the requested branch, just pull latest
        console.log(`Already on branch ${branch}, pulling latest changes...`);
        await this.pullLatestChanges(originPath, branch);
      } else {
        // Fetch and checkout different branch
        await this.switchToBranch(originPath, branch);
      }
      
      console.log(`Successfully on branch ${branch}`);
    } catch (error) {
      console.warn(`Failed to fetch/checkout branch ${branch}, falling back to current branch:`, error);
      // Don't throw - we'll use whatever branch is currently checked out
    }
  }

  private async switchToBranch(repoPath: string, branch: string): Promise<void> {
    try {
      // Try to fetch the branch without specifying local name
      await this.executeGitCommand(
        `git fetch --depth ${this.config.fetchDepth} origin ${branch}`,
        { cwd: repoPath }
      );
      
      // Checkout the branch
      await this.executeGitCommand(
        `git checkout -B ${branch} origin/${branch}`,
        { cwd: repoPath }
      );
    } catch (error) {
      // If branch doesn't exist remotely, try just checking out locally
      if (error instanceof Error && error.message.includes('not found')) {
        await this.executeGitCommand(
          `git checkout ${branch}`,
          { cwd: repoPath }
        );
      } else {
        throw error;
      }
    }
  }

  async createWorktree(
    originPath: string,
    worktreePath: string,
    branchName: string,
    baseBranch: string = "main"
  ): Promise<void> {
    // Wait for any existing worktree operation on this repo to complete
    const existingLock = this.worktreeLocks.get(originPath);
    if (existingLock) {
      console.log(`Waiting for existing worktree operation on ${originPath}...`);
      await existingLock;
    }

    // Create a new lock for this operation
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = () => {
        this.worktreeLocks.delete(originPath);
        resolve();
      };
    });
    this.worktreeLocks.set(originPath, lockPromise);

    console.log(`Creating worktree with new branch ${branchName}...`);
    try {
      await this.executeGitCommand(
        `git worktree add -b "${branchName}" "${worktreePath}" origin/${baseBranch}`,
        { cwd: originPath }
      );
      console.log(`Successfully created worktree at ${worktreePath}`);
      
      // Set up branch configuration to push to the same name on remote
      await this.executeGitCommand(
        `git config branch.${branchName}.remote origin`,
        { cwd: worktreePath }
      );
      await this.executeGitCommand(
        `git config branch.${branchName}.merge refs/heads/${branchName}`,
        { cwd: worktreePath }
      );
      console.log(`Configured branch ${branchName} to track origin/${branchName} when pushed`);
      
      // Set up git hooks in the worktree
      await this.setupGitHooks(worktreePath);
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        throw new Error(`Worktree already exists at ${worktreePath}`);
      }
      throw error;
    } finally {
      // Always release the lock
      releaseLock!();
    }
  }

  // Method to update configuration at runtime
  updateConfig(config: Partial<GitConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private async setupGitHooks(repoPath: string): Promise<void> {
    try {
      // Determine if this is a worktree or main repository
      const gitDir = path.join(repoPath, '.git');
      const gitDirStat = await fs.stat(gitDir);
      
      let hooksDir: string;
      if (gitDirStat.isDirectory()) {
        // Regular repository
        hooksDir = path.join(gitDir, 'hooks');
      } else {
        // Worktree - read the .git file to find the actual git directory
        const gitFileContent = await fs.readFile(gitDir, 'utf8');
        const match = gitFileContent.match(/gitdir: (.+)/);
        if (!match) {
          console.warn(`Could not parse .git file in ${repoPath}`);
          return;
        }
        const actualGitDir = match[1].trim();
        // For worktrees, hooks are in the common git directory
        const commonDir = path.join(path.dirname(actualGitDir), 'commondir');
        try {
          const commonDirContent = await fs.readFile(commonDir, 'utf8');
          const commonPath = commonDirContent.trim();
          // If commondir is relative, resolve it from the worktree git directory
          const resolvedCommonPath = path.isAbsolute(commonPath) 
            ? commonPath 
            : path.resolve(path.dirname(actualGitDir), commonPath);
          hooksDir = path.join(resolvedCommonPath, 'hooks');
        } catch {
          // Fallback to the hooks in the worktree's git directory
          hooksDir = path.join(actualGitDir, 'hooks');
        }
      }

      // Create hooks directory if it doesn't exist
      await fs.mkdir(hooksDir, { recursive: true });

      // Configure hooks
      const hooksConfig: GitHooksConfig = {
        protectedBranches: ['main', 'master', 'develop', 'production', 'staging'],
        allowForcePush: false,
        allowBranchDeletion: false
      };

      // Write pre-push hook
      const prePushPath = path.join(hooksDir, 'pre-push');
      await fs.writeFile(prePushPath, generatePrePushHook(hooksConfig), { mode: 0o755 });
      console.log(`Created pre-push hook at ${prePushPath}`);

      // Write pre-commit hook
      const preCommitPath = path.join(hooksDir, 'pre-commit');
      await fs.writeFile(preCommitPath, generatePreCommitHook(hooksConfig), { mode: 0o755 });
      console.log(`Created pre-commit hook at ${preCommitPath}`);
    } catch (error) {
      console.warn(`Failed to set up git hooks in ${repoPath}:`, error);
      // Don't throw - hooks are nice to have but not critical
    }
  }
}