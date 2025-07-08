import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

interface RepositoryOperation {
  promise: Promise<void>;
  timestamp: number;
}

export class RepositoryManager {
  private static instance: RepositoryManager;
  private operations = new Map<string, RepositoryOperation>();
  private worktreeLocks = new Map<string, Promise<void>>();
  private readonly OPERATION_CACHE_TIME = 5000; // 5 seconds

  private constructor() {}

  static getInstance(): RepositoryManager {
    if (!RepositoryManager.instance) {
      RepositoryManager.instance = new RepositoryManager();
    }
    return RepositoryManager.instance;
  }

  private getCacheKey(repoUrl: string, operation: string): string {
    return `${repoUrl}:${operation}`;
  }

  private cleanupStaleOperations(): void {
    const now = Date.now();
    for (const [key, op] of this.operations.entries()) {
      if (now - op.timestamp > this.OPERATION_CACHE_TIME) {
        this.operations.delete(key);
      }
    }
  }

  async ensureRepository(repoUrl: string, originPath: string, branch: string = "main"): Promise<void> {
    this.cleanupStaleOperations();

    // Check if repo exists
    const repoExists = await this.checkIfRepoExists(originPath);

    if (!repoExists) {
      // Clone operation
      const cloneKey = this.getCacheKey(repoUrl, "clone");
      const existingClone = this.operations.get(cloneKey);
      
      if (existingClone && Date.now() - existingClone.timestamp < this.OPERATION_CACHE_TIME) {
        console.log(`Reusing existing clone operation for ${repoUrl}`);
        await existingClone.promise;
        return;
      }

      const clonePromise = this.cloneRepository(repoUrl, originPath);
      this.operations.set(cloneKey, {
        promise: clonePromise,
        timestamp: Date.now(),
      });

      await clonePromise;
    } else {
      // Fetch operation
      const fetchKey = this.getCacheKey(repoUrl, `fetch:${branch}`);
      const existingFetch = this.operations.get(fetchKey);
      
      if (existingFetch && Date.now() - existingFetch.timestamp < this.OPERATION_CACHE_TIME) {
        console.log(`Reusing existing fetch operation for ${repoUrl} branch ${branch}`);
        await existingFetch.promise;
        return;
      }

      const fetchPromise = this.fetchBranch(originPath, branch);
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
    console.log(`Cloning repository ${repoUrl} with depth 1...`);
    try {
      await execAsync(`git clone --depth 1 "${repoUrl}" "${originPath}"`);
      console.log(`Successfully cloned ${repoUrl}`);
    } catch (error) {
      console.error(`Failed to clone ${repoUrl}:`, error);
      throw error;
    }
  }

  private async fetchBranch(originPath: string, branch: string): Promise<void> {
    console.log(`Fetching latest changes for branch ${branch}...`);
    try {
      await execAsync(`git fetch --depth 1 origin ${branch}`, {
        cwd: originPath,
      });
      console.log(`Successfully fetched ${branch}`);
    } catch (error) {
      console.warn("Failed to fetch latest changes:", error);
      // Don't throw - fetch failures are often not critical
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
      await execAsync(
        `git worktree add -b "${branchName}" "${worktreePath}" origin/${baseBranch}`,
        { cwd: originPath }
      );
      console.log(`Successfully created worktree at ${worktreePath}`);
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
}