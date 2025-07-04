import { exec } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

interface WorkspaceResult {
  success: boolean;
  worktreePath?: string;
  error?: string;
}

interface WorktreeInfo {
  appDataPath: string;
  projectsPath: string;
  projectPath: string;
  originPath: string;
  worktreesPath: string;
  branchName: string;
  worktreePath: string;
  repoName: string;
}

async function getAppDataPath(): Promise<string> {
  const appName = "manaflow3";
  const platform = process.platform;

  if (platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", appName);
  } else if (platform === "win32") {
    return path.join(process.env.APPDATA || "", appName);
  } else {
    return path.join(os.homedir(), ".config", appName);
  }
}

function extractRepoName(repoUrl: string): string {
  const match = repoUrl.match(/([^/]+)\.git$/);
  if (match) {
    return match[1];
  }

  const parts = repoUrl.split("/");
  return parts[parts.length - 1] || "unknown-repo";
}

async function checkIfRepoExists(repoPath: string): Promise<boolean> {
  try {
    await fs.access(path.join(repoPath, ".git"));
    return true;
  } catch {
    return false;
  }
}

export async function getWorktreePath(args: {
  repoUrl: string;
  branch?: string;
}): Promise<WorktreeInfo> {
  const appDataPath = await getAppDataPath();
  const projectsPath = path.join(appDataPath, "projects");
  const repoName = extractRepoName(args.repoUrl);
  const projectPath = path.join(projectsPath, repoName);
  const originPath = path.join(projectPath, "origin");
  const worktreesPath = path.join(projectPath, "worktrees");

  const timestamp = Date.now();
  const branchName = `coderouter-${timestamp}`;
  const worktreePath = path.join(worktreesPath, branchName);

  return {
    appDataPath,
    projectsPath,
    projectPath,
    originPath,
    worktreesPath,
    branchName,
    worktreePath,
    repoName,
  };
}

export async function setupProjectWorkspace(args: {
  repoUrl: string;
  branch?: string;
  worktreeInfo: WorktreeInfo;
}): Promise<WorkspaceResult> {
  try {
    const { worktreeInfo } = args;
    const baseBranch = args.branch || "main";

    await fs.mkdir(worktreeInfo.projectPath, { recursive: true });
    await fs.mkdir(worktreeInfo.worktreesPath, { recursive: true });

    const repoExists = await checkIfRepoExists(worktreeInfo.originPath);

    if (!repoExists) {
      console.log(`Cloning repository ${args.repoUrl} with depth 1...`);
      await execAsync(
        `git clone --depth 1 "${args.repoUrl}" "${worktreeInfo.originPath}"`
      );
    } else {
      console.log(`Repository already exists, fetching latest changes...`);
      try {
        await execAsync(`git fetch --depth 1 origin ${baseBranch}`, {
          cwd: worktreeInfo.originPath,
        });
      } catch (error) {
        console.warn("Failed to fetch latest changes:", error);
      }
    }

    console.log(
      `Creating worktree with new branch ${worktreeInfo.branchName}...`
    );
    try {
      await execAsync(
        `git worktree add -b "${worktreeInfo.branchName}" "${worktreeInfo.worktreePath}" origin/${baseBranch}`,
        { cwd: worktreeInfo.originPath }
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        throw new Error(
          `Worktree already exists at ${worktreeInfo.worktreePath}`
        );
      }
      throw error;
    }

    return { success: true, worktreePath: worktreeInfo.worktreePath };
  } catch (error) {
    console.error("Failed to setup workspace:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
