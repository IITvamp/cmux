import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import os from "os";

const execAsync = promisify(exec);

interface WorkspaceResult {
  success: boolean;
  worktreePath?: string;
  error?: string;
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

export async function setupProjectWorkspace(args: {
  repoUrl: string;
  branch?: string;
}): Promise<WorkspaceResult> {
  try {
    const appDataPath = await getAppDataPath();
    const projectsPath = path.join(appDataPath, "projects");
    
    const repoName = extractRepoName(args.repoUrl);
    const projectPath = path.join(projectsPath, repoName);
    const originPath = path.join(projectPath, "origin");
    const worktreesPath = path.join(projectPath, "worktrees");
    
    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(worktreesPath, { recursive: true });
    
    const baseBranch = args.branch || "main";
    const timestamp = Date.now();
    const newBranchName = `coderouter-${timestamp}`;
    const worktreePath = path.join(worktreesPath, newBranchName);
    
    const repoExists = await checkIfRepoExists(originPath);
    
    if (!repoExists) {
      console.log(`Cloning repository ${args.repoUrl} with depth 1...`);
      await execAsync(`git clone --depth 1 "${args.repoUrl}" "${originPath}"`);
    } else {
      console.log(`Repository already exists, fetching latest changes...`);
      try {
        await execAsync(`git fetch --depth 1 origin ${baseBranch}`, { cwd: originPath });
      } catch (error) {
        console.warn("Failed to fetch latest changes:", error);
      }
    }
    
    console.log(`Creating worktree with new branch ${newBranchName}...`);
    try {
      await execAsync(
        `git worktree add -b "${newBranchName}" "${worktreePath}" origin/${baseBranch}`,
        { cwd: originPath }
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        throw new Error(`Worktree already exists at ${worktreePath}`);
      }
      throw error;
    }
    
    return { success: true, worktreePath };
  } catch (error) {
    console.error("Failed to setup workspace:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}