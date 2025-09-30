#!/usr/bin/env bun

import { $ } from "bun";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const WORKSPACE_DIR = "/root/workspace";
const branchName = process.env.CMUX_BRANCH_NAME;
const commitMessage = process.env.CMUX_COMMIT_MESSAGE;

function log(message: string, data?: Record<string, unknown>): void {
  const formattedData = data
    ? ` ${Object.entries(data)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ")}`
    : "";
  console.error(`[cmux auto-commit]${formattedData} ${message}`);
}

if (!branchName || !commitMessage) {
  log("Missing required environment variables");
  log(`CMUX_BRANCH_NAME=${branchName || "(not set)"}`);
  log(`CMUX_COMMIT_MESSAGE=${commitMessage || "(not set)"}`);
  process.exit(1);
}

async function checkoutBranch(repoPath: string): Promise<void> {
  try {
    await $`git -C ${repoPath} checkout -b ${branchName}`.quiet();
  } catch {
    await $`git -C ${repoPath} checkout ${branchName}`;
  }
}

async function commitChanges(repoPath: string): Promise<void> {
  try {
    await $`git -C ${repoPath} commit -m ${commitMessage}`;
    log("Commit created", { repo: repoPath });
  } catch (e) {
    const hasChanges = await $`git -C ${repoPath} status --short`.text();
    if (hasChanges.trim()) {
      log("Commit failed with pending changes", { repo: repoPath });
      throw e;
    }
    log("Nothing to commit", { repo: repoPath });
  }
}

async function syncWithRemote(repoPath: string): Promise<void> {
  const remoteBranch =
    await $`git -C ${repoPath} ls-remote --heads origin ${branchName}`
      .text()
      .catch(() => "");

  if (remoteBranch.trim()) {
    log("Rebasing onto remote branch", { repo: repoPath, branch: branchName });
    await $`git -C ${repoPath} pull --rebase origin ${branchName}`;
  } else {
    log("Remote branch does not exist, will create", {
      repo: repoPath,
      branch: branchName,
    });
  }
}

async function processRepository(repoPath: string): Promise<void> {
  log("Processing repository", { repo: repoPath });

  const origin = await $`git -C ${repoPath} config --get remote.origin.url`
    .text()
    .catch(() => "");
  log("Repository origin", { repo: repoPath, origin: origin.trim() });

  await $`git -C ${repoPath} add -A`;
  log("Staged all changes", { repo: repoPath });

  await checkoutBranch(repoPath);
  log("Checked out branch", { repo: repoPath, branch: branchName });

  await commitChanges(repoPath);
  await syncWithRemote(repoPath);

  log("Pushing to remote", { repo: repoPath, branch: branchName });
  await $`git -C ${repoPath} push -u origin ${branchName}`;
}

async function isValidGitRepo(path: string): Promise<boolean> {
  try {
    await $`git -C ${path} rev-parse --is-inside-work-tree`.quiet();
    return true;
  } catch {
    return false;
  }
}

async function findGitRepositories(): Promise<string[]> {
  if (!existsSync(WORKSPACE_DIR)) {
    return [];
  }

  const workspaceGitPath = join(WORKSPACE_DIR, ".git");

  if (existsSync(workspaceGitPath)) {
    const isValid = await isValidGitRepo(WORKSPACE_DIR);
    if (isValid) {
      log("Workspace is a git repository", { path: WORKSPACE_DIR });
      return [resolve(WORKSPACE_DIR)];
    }
    log("Workspace has .git but is not a valid repository");
  }

  log("Scanning workspace for git repositories");
  const dirEntries = await readdir(WORKSPACE_DIR, {
    withFileTypes: true,
  }).catch(() => []);

  const checkPromises = dirEntries
    .filter((entry) => entry.isDirectory())
    .map(async (entry) => {
      const repoDir = join(WORKSPACE_DIR, entry.name);
      const gitPath = join(repoDir, ".git");

      if (!existsSync(gitPath)) {
        return null;
      }

      const isValid = await isValidGitRepo(repoDir);
      if (isValid) {
        const repoPath = resolve(repoDir);
        log("Found git repository", { path: repoPath });
        return repoPath;
      }

      return null;
    });

  const results = await Promise.all(checkPromises);
  return results.filter((path): path is string => path !== null);
}

async function main(): Promise<void> {
  log("Starting auto-commit", { cwd: process.cwd() });

  const repoPaths = await findGitRepositories();

  if (repoPaths.length === 0) {
    log("No git repositories found");
    return;
  }

  log(`Processing ${repoPaths.length} repositories in parallel`);

  const results = await Promise.allSettled(
    repoPaths.map((repoPath) => processRepository(repoPath))
  );

  let successCount = 0;
  let failCount = 0;

  results.forEach((result, index) => {
    const repoPath = repoPaths[index];
    if (result.status === "fulfilled") {
      successCount++;
      log("✓ Repository succeeded", { repo: repoPath });
    } else {
      failCount++;
      log("✗ Repository failed", { repo: repoPath, error: result.reason });
    }
  });

  log(`Completed: ${successCount} succeeded, ${failCount} failed`);

  if (failCount > 0) {
    process.exit(1);
  }
}

await main().catch((error) => {
  log("Fatal error", { error });
  process.exit(1);
});
