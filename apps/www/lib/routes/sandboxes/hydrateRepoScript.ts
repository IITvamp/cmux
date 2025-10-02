#!/usr/bin/env bun

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

interface HydrateConfig {
  workspacePath: string;
  owner?: string;
  repo?: string;
  repoFull?: string;
  cloneUrl?: string;
  maskedCloneUrl?: string;
  depth: number;
  baseBranch?: string;
  newBranch?: string;
}

function log(message: string, level: "info" | "error" | "debug" = "info") {
  const prefix = `[hydrate-repo]`;
  const timestamp = new Date().toISOString();

  if (level === "error") {
    console.error(`${timestamp} ${prefix} ERROR: ${message}`);
  } else if (level === "debug") {
    console.log(`${timestamp} ${prefix} DEBUG: ${message}`);
  } else {
    console.log(`${timestamp} ${prefix} ${message}`);
  }
}

function exec(command: string, options?: { cwd?: string; throwOnError?: boolean }): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  const { cwd, throwOnError = true } = options || {};

  log(`Executing: ${command.slice(0, 200)}${command.length > 200 ? '...' : ''}`, "debug");

  try {
    const stdout = execSync(command, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (error) {
    const errorObj = error as { status?: number; stderr?: Buffer; stdout?: Buffer };
    const exitCode = errorObj.status || 1;
    const stderr = errorObj.stderr?.toString() || "";
    const stdout = errorObj.stdout?.toString() || "";

    log(`Command failed with exit code ${exitCode}`, "debug");
    log(`stderr: ${stderr.slice(0, 500)}`, "debug");

    if (throwOnError) {
      throw error;
    }

    return { stdout, stderr, exitCode };
  }
}

function getConfig(): HydrateConfig {
  const workspacePath = process.env.CMUX_WORKSPACE_PATH || "/root/workspace";
  const depth = parseInt(process.env.CMUX_DEPTH || "1", 10);

  // Check if we have repo config
  const owner = process.env.CMUX_OWNER;
  const repo = process.env.CMUX_REPO;
  const repoFull = process.env.CMUX_REPO_FULL;
  const cloneUrl = process.env.CMUX_CLONE_URL;
  const maskedCloneUrl = process.env.CMUX_MASKED_CLONE_URL;
  const baseBranch = process.env.CMUX_BASE_BRANCH;
  const newBranch = process.env.CMUX_NEW_BRANCH;

  return {
    workspacePath,
    owner,
    repo,
    repoFull,
    cloneUrl,
    maskedCloneUrl,
    depth,
    baseBranch,
    newBranch,
  };
}

function ensureWorkspace(workspacePath: string) {
  log(`Ensuring workspace exists at ${workspacePath}`);
  exec(`mkdir -p "${workspacePath}"`);
}

function checkExistingRepo(workspacePath: string, owner?: string, repo?: string): {
  hasGit: boolean;
  remoteUrl?: string;
  needsClear: boolean;
} {
  const gitPath = join(workspacePath, ".git");
  const hasGit = existsSync(gitPath);

  if (!hasGit) {
    log("No existing git repository found");
    return { hasGit: false, needsClear: false };
  }

  log("Found existing git repository");

  // Get remote URL
  const { stdout: remoteUrl, exitCode } = exec(
    `git remote get-url origin`,
    { cwd: workspacePath, throwOnError: false }
  );

  if (exitCode !== 0) {
    log("Could not get remote URL", "debug");
    return { hasGit: true, needsClear: false };
  }

  const trimmedRemoteUrl = remoteUrl.trim();
  log(`Current remote: ${trimmedRemoteUrl}`);

  // Check if remote matches expected repo
  if (owner && repo && !trimmedRemoteUrl.includes(`${owner}/${repo}`)) {
    log(`Remote mismatch: expected ${owner}/${repo}, got ${trimmedRemoteUrl}`);
    return { hasGit: true, remoteUrl: trimmedRemoteUrl, needsClear: true };
  }

  return { hasGit: true, remoteUrl: trimmedRemoteUrl, needsClear: false };
}

function clearWorkspace(workspacePath: string) {
  log("Clearing workspace directory");
  exec(`rm -rf "${workspacePath}"/* "${workspacePath}"/.[!.]* "${workspacePath}"/..?* 2>/dev/null || true`);
}

function cloneRepository(config: HydrateConfig) {
  const { workspacePath, cloneUrl, maskedCloneUrl, depth } = config;

  log(`GIT CLONE: Starting clone of ${maskedCloneUrl || cloneUrl} with depth=${depth}`);
  log(`GIT CLONE: Target directory: ${workspacePath}`);

  const { exitCode, stderr } = exec(
    `git clone --depth ${depth} "${cloneUrl}" "${workspacePath}"`,
    { throwOnError: false }
  );

  if (exitCode !== 0) {
    log(`GIT CLONE: Failed with exit code ${exitCode}: ${stderr}`, "error");
    throw new Error(`Failed to clone repository: ${stderr}`);
  }

  log("GIT CLONE: Repository cloned successfully");
}

function fetchUpdates(workspacePath: string) {
  log("GIT FETCH: Fetching updates from remote");

  const { exitCode, stderr } = exec(
    `git fetch --all --prune`,
    { cwd: workspacePath, throwOnError: false }
  );

  if (exitCode !== 0) {
    log(`GIT FETCH: Failed with exit code ${exitCode}: ${stderr}`, "debug");
  } else {
    log("GIT FETCH: Fetched updates successfully");
  }
}

function checkoutBranch(workspacePath: string, baseBranch: string, newBranch?: string) {
  log(`GIT CHECKOUT: Checking out base branch: ${baseBranch}`);

  // Try to checkout the base branch
  let checkoutResult = exec(
    `git checkout "${baseBranch}"`,
    { cwd: workspacePath, throwOnError: false }
  );

  if (checkoutResult.exitCode !== 0) {
    log(`GIT CHECKOUT: Direct checkout failed, trying to create from origin/${baseBranch}`);
    checkoutResult = exec(
      `git checkout -b "${baseBranch}" "origin/${baseBranch}"`,
      { cwd: workspacePath, throwOnError: false }
    );
  }

  if (checkoutResult.exitCode === 0) {
    log(`GIT CHECKOUT: Successfully checked out ${baseBranch}`);

    // Pull latest changes
    log(`GIT PULL: Pulling latest changes for ${baseBranch}`);
    const { exitCode: pullExitCode, stderr: pullStderr } = exec(
      `git pull --ff-only`,
      { cwd: workspacePath, throwOnError: false }
    );

    if (pullExitCode === 0) {
      log("GIT PULL: Pulled latest changes successfully");
    } else {
      log(`GIT PULL: Failed with exit code ${pullExitCode} (may be up to date or have conflicts): ${pullStderr}`, "debug");
    }
  } else {
    log(`GIT CHECKOUT: Failed to checkout ${baseBranch} with exit code ${checkoutResult.exitCode}: ${checkoutResult.stderr}`, "error");
  }

  // Create and switch to new branch if specified
  if (newBranch) {
    log(`GIT BRANCH: Creating new branch: ${newBranch}`);
    const { exitCode, stderr } = exec(
      `git switch -C "${newBranch}"`,
      { cwd: workspacePath, throwOnError: false }
    );

    if (exitCode === 0) {
      log(`GIT BRANCH: Successfully switched to new branch: ${newBranch}`);
    } else {
      log(`GIT BRANCH: Failed to create branch ${newBranch} with exit code ${exitCode}: ${stderr}`, "error");
    }
  }
}

function hydrateSubdirectories(workspacePath: string) {
  log("Checking for subdirectory git repositories");

  try {
    const dirs = execSync(`find "${workspacePath}" -maxdepth 1 -type d ! -path "${workspacePath}"`, {
      encoding: "utf-8"
    }).trim().split('\n').filter(Boolean);

    for (const dir of dirs) {
      const gitPath = join(dir, ".git");
      if (existsSync(gitPath)) {
        log(`Pulling updates in ${dir}`);
        exec(`git pull --ff-only`, { cwd: dir, throwOnError: false });
      }
    }
  } catch (error) {
    log(`Error checking subdirectories: ${error}`, "debug");
  }
}

async function main() {
  try {
    const config = getConfig();
    log(`Starting hydration for workspace: ${config.workspacePath}`);

    // Ensure workspace exists
    ensureWorkspace(config.workspacePath);

    // Handle single repo case
    if (config.cloneUrl) {
      log(`Hydrating single repository: ${config.maskedCloneUrl || config.cloneUrl}`);

      // Check existing repo
      log("GIT STATUS: Checking for existing repository");
      const { hasGit, needsClear } = checkExistingRepo(
        config.workspacePath,
        config.owner,
        config.repo
      );

      if (needsClear) {
        log("GIT SETUP: Clearing workspace due to repo mismatch");
        clearWorkspace(config.workspacePath);
      }

      if (!hasGit || needsClear) {
        // Clone repository
        cloneRepository(config);
      } else {
        // Fetch updates
        log("GIT SETUP: Existing repo found, fetching updates");
        fetchUpdates(config.workspacePath);
      }

      // Checkout branch
      if (config.baseBranch) {
        log(`GIT SETUP: Checking out baseBranch=${config.baseBranch}, newBranch=${config.newBranch || '(none)'}`);
        checkoutBranch(config.workspacePath, config.baseBranch, config.newBranch);
      }

      log("Listing workspace contents:");
      const { stdout } = exec(`ls -la | head -50`, { cwd: config.workspacePath });
      console.log(stdout);
    } else {
      // Handle multiple repos case
      log("Hydrating multiple repositories");
      hydrateSubdirectories(config.workspacePath);
    }

    log("Hydration completed successfully");
    process.exit(0);
  } catch (error) {
    log(`Fatal error: ${error}`, "error");
    if (error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  log(`Unhandled error: ${error}`, "error");
  process.exit(1);
});