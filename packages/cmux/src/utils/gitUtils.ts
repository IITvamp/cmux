import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export type GitRepoInfo = {
  path: string;
  isGitRepo: boolean;
  remoteName?: string;
  remoteUrl?: string;
  currentBranch?: string;
  defaultBranch?: string;
};

export function getGitRepoInfo(repoPath: string): GitRepoInfo {
  const absolutePath = path.resolve(repoPath);
  
  // Check if path exists
  if (!existsSync(absolutePath)) {
    throw new Error(`Path does not exist: ${absolutePath}`);
  }
  
  // Check if it's a git repository
  try {
    execSync("git rev-parse --git-dir", { 
      cwd: absolutePath,
      stdio: "pipe" 
    });
  } catch {
    return {
      path: absolutePath,
      isGitRepo: false
    };
  }
  
  // Get repository information
  try {
    // Get remote URL
    const remoteUrl = execSync("git config --get remote.origin.url", {
      cwd: absolutePath,
      encoding: "utf8"
    }).trim();
    
    // Extract remote name from URL
    let remoteName = "";
    if (remoteUrl) {
      // Handle various git URL formats
      // SSH format: git@github.com:owner/repo.git
      // HTTPS format: https://github.com/owner/repo.git
      // Also handle gitlab, bitbucket, etc.
      const patterns = [
        /git@([^:]+):([^/]+\/[^/]+?)(?:\.git)?$/,  // SSH format
        /https?:\/\/([^/]+)\/([^/]+\/[^/]+?)(?:\.git)?$/,  // HTTPS format
      ];
      
      for (const pattern of patterns) {
        const match = remoteUrl.match(pattern);
        if (match) {
          remoteName = match[2];
          break;
        }
      }
      
      // If still no match, try a more generic pattern
      if (!remoteName) {
        const genericMatch = remoteUrl.match(/([^/:]+\/[^/]+?)(?:\.git)?$/);
        if (genericMatch) {
          remoteName = genericMatch[1];
        }
      }
    }
    
    // Get current branch
    const currentBranch = execSync("git branch --show-current", {
      cwd: absolutePath,
      encoding: "utf8"
    }).trim();
    
    // Get default branch (try to detect from remote)
    let defaultBranch = "main";
    try {
      const remoteBranches = execSync("git branch -r", {
        cwd: absolutePath,
        encoding: "utf8"
      });
      
      if (remoteBranches.includes("origin/main")) {
        defaultBranch = "main";
      } else if (remoteBranches.includes("origin/master")) {
        defaultBranch = "master";
      }
    } catch {
      // Fallback to main if can't detect
    }
    
    return {
      path: absolutePath,
      isGitRepo: true,
      remoteName,
      remoteUrl,
      currentBranch: currentBranch || defaultBranch,
      defaultBranch
    };
  } catch (error) {
    // Repository exists but couldn't get all info
    return {
      path: absolutePath,
      isGitRepo: true
    };
  }
}