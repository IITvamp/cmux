import { exec } from "node:child_process";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";
import { RepositoryManager } from "../repositoryManager.js";
import { serverLogger } from "./fileLogger.js";

const execAsync = promisify(exec);

interface ApplyGitBundleOptions {
  bundleBase64: string;
  branchName: string;
  worktreePath: string;
  repoUrl?: string;
  teamSlugOrId: string;
}

/**
 * Apply a git bundle to both the worktree and the rust git cache
 */
export async function applyGitBundle({
  bundleBase64,
  branchName,
  worktreePath,
  repoUrl,
  teamSlugOrId,
}: ApplyGitBundleOptions): Promise<void> {
  const bundleFile = `/tmp/bundle-${Date.now()}.bundle`;

  try {
    // Write the bundle to a temporary file
    const bundleData = Buffer.from(bundleBase64, "base64");
    await fs.writeFile(bundleFile, bundleData);
    serverLogger.info(
      `[applyGitBundle] Wrote bundle file: ${bundleFile} (${bundleData.length} bytes)`
    );

    // 1. Apply to the worktree
    await applyBundleToWorktree(bundleFile, worktreePath, branchName);

    // 2. Apply to the main repository (parent of worktree)
    const mainRepoPath = await getMainRepoPath(worktreePath);
    if (mainRepoPath) {
      await applyBundleToRepo(bundleFile, mainRepoPath, branchName);
    }

    // 3. Apply to the rust git cache if we have a repo URL
    if (repoUrl) {
      await applyBundleToRustCache(bundleFile, repoUrl, branchName);
    }

    serverLogger.info(
      `[applyGitBundle] Successfully applied bundle for branch ${branchName}`
    );
  } catch (error) {
    serverLogger.error("[applyGitBundle] Failed to apply git bundle:", error);
    throw error;
  } finally {
    // Clean up the bundle file
    try {
      await fs.unlink(bundleFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Apply a git bundle to a worktree
 */
async function applyBundleToWorktree(
  bundleFile: string,
  worktreePath: string,
  branchName: string
): Promise<void> {
  try {
    // First, verify the bundle
    const { stdout: verifyOutput } = await execAsync(
      `git bundle verify ${bundleFile}`,
      { cwd: worktreePath }
    );
    serverLogger.info(
      `[applyBundleToWorktree] Bundle verification: ${verifyOutput}`
    );

    // Fetch from the bundle
    await execAsync(
      `git fetch ${bundleFile} ${branchName}:${branchName}`,
      { cwd: worktreePath }
    );

    serverLogger.info(
      `[applyBundleToWorktree] Applied bundle to worktree at ${worktreePath}`
    );
  } catch (error) {
    serverLogger.error(
      `[applyBundleToWorktree] Failed to apply bundle to worktree:`,
      error
    );
    throw error;
  }
}

/**
 * Apply a git bundle to the main repository
 */
async function applyBundleToRepo(
  bundleFile: string,
  repoPath: string,
  branchName: string
): Promise<void> {
  try {
    // Fetch from the bundle
    await execAsync(
      `git fetch ${bundleFile} ${branchName}:${branchName}`,
      { cwd: repoPath }
    );

    serverLogger.info(
      `[applyBundleToRepo] Applied bundle to main repo at ${repoPath}`
    );
  } catch (error) {
    serverLogger.error(
      `[applyBundleToRepo] Failed to apply bundle to main repo:`,
      error
    );
    // Don't throw - this is not critical
  }
}

/**
 * Apply a git bundle to the rust git cache
 */
async function applyBundleToRustCache(
  bundleFile: string,
  repoUrl: string,
  branchName: string
): Promise<void> {
  try {
    // Get the rust git cache directory
    const rustCacheDir = process.env.CMUX_RUST_GIT_CACHE ||
      path.join(process.env.HOME || "/root", ".cache", "cmux-git-cache");

    // Generate the cache slug from the repo URL
    const repoSlug = repoUrl
      .replace(/\.git$/, "")
      .split("/")
      .slice(-2)
      .reverse()
      .join("__");

    const rustRepoPath = path.join(rustCacheDir, repoSlug);

    // Check if the rust cache repo exists
    try {
      await fs.access(rustRepoPath);
    } catch {
      serverLogger.info(
        `[applyBundleToRustCache] Rust cache repo doesn't exist at ${rustRepoPath}, skipping`
      );
      return;
    }

    // Fetch from the bundle
    await execAsync(
      `git fetch ${bundleFile} ${branchName}:${branchName}`,
      { cwd: rustRepoPath }
    );

    serverLogger.info(
      `[applyBundleToRustCache] Applied bundle to rust cache at ${rustRepoPath}`
    );
  } catch (error) {
    serverLogger.error(
      `[applyBundleToRustCache] Failed to apply bundle to rust cache:`,
      error
    );
    // Don't throw - this is not critical
  }
}

/**
 * Get the main repository path from a worktree path
 */
async function getMainRepoPath(worktreePath: string): Promise<string | null> {
  try {
    // Get the git directory
    const { stdout: gitDir } = await execAsync(
      "git rev-parse --git-dir",
      { cwd: worktreePath }
    );
    const gitDirPath = gitDir.trim();

    // If it's a worktree, the .git file contains the path to the git directory
    if (gitDirPath.includes(".git/worktrees/")) {
      // Extract the main repo path from the worktree git directory
      const mainRepoPath = gitDirPath.replace(/\.git\/worktrees\/.*$/, "");
      return mainRepoPath;
    }

    // If it's not a worktree, return the current path
    return worktreePath;
  } catch (error) {
    serverLogger.error(
      "[getMainRepoPath] Failed to get main repo path:",
      error
    );
    return null;
  }
}