import { existsSync } from "node:fs";
import { join } from "node:path";

import { log } from "../logger";
import { WORKSPACE_ROOT, execAsync } from "./utils";

type ExecError = Error & {
  stdout?: string | Buffer;
  stderr?: string | Buffer;
  code?: number;
  status?: number;
};

let gitRepoPath: string | null = null;

export async function detectGitRepoPath(): Promise<string> {
  if (gitRepoPath) {
    return gitRepoPath;
  }

  if (existsSync(join(WORKSPACE_ROOT, ".git"))) {
    gitRepoPath = WORKSPACE_ROOT;
    log("INFO", "Git repository found at workspace root", {
      path: gitRepoPath,
    });
    return gitRepoPath;
  }

  try {
    const { stdout: dirs } = await execAsync(
      `ls -d ${WORKSPACE_ROOT}/*/ 2>/dev/null || true`,
      {
        cwd: WORKSPACE_ROOT,
      },
    );

    if (dirs && dirs.trim()) {
      const dirList = dirs.trim().split("\n");
      for (const dir of dirList) {
        const trimmedDir = dir.replace(/\/$/, "");
        if (existsSync(join(trimmedDir, ".git"))) {
          gitRepoPath = trimmedDir;
          log("INFO", "Git repository found in subdirectory", {
            path: gitRepoPath,
          });
          return gitRepoPath;
        }
      }
    }

    const { stdout } = await execAsync(
      `find ${WORKSPACE_ROOT} -maxdepth 2 -type d -name .git 2>/dev/null | head -1`,
      {
        cwd: WORKSPACE_ROOT,
      },
    );

    if (stdout && stdout.trim()) {
      const gitDir = stdout.trim();
      gitRepoPath = gitDir.replace(/\/.git$/, "");
      log("INFO", "Git repository found via find command", {
        path: gitRepoPath,
      });
      return gitRepoPath;
    }
  } catch (error) {
    log("WARN", "Failed to search for git repositories", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  log("WARN", "No git repository found, using workspace root", {
    path: WORKSPACE_ROOT,
  });
  gitRepoPath = WORKSPACE_ROOT;
  return gitRepoPath;
}

export async function runGitCommand(
  command: string,
  allowFailure = false,
): Promise<{ stdout: string; stderr: string; exitCode: number } | null> {
  const formatOutput = (value: string | Buffer): string => String(value);

  try {
    const repoPath = await detectGitRepoPath();
    const result = await execAsync(command, {
      cwd: repoPath,
      maxBuffer: 10 * 1024 * 1024,
    });
    const stdout = formatOutput(result.stdout);
    const stderr = formatOutput(result.stderr);
    return { stdout, stderr, exitCode: 0 };
  } catch (error) {
    const execError: ExecError =
      error instanceof Error
        ? error
        : new Error(
            typeof error === "string" ? error : "Unknown git command error",
          );
    const stdout = formatOutput(execError.stdout ?? "");
    const stderr = formatOutput(execError.stderr ?? "");
    const exitCode = execError.code ?? execError.status ?? 1;
    const errorPayload = {
      command,
      message: execError.message,
      exitCode,
      stdout: stdout?.slice(0, 500),
      stderr: stderr?.slice(0, 500),
    };
    if (!allowFailure) {
      log("ERROR", "Git command failed", errorPayload);
      throw error;
    }
    log("WARN", "Git command failed (ignored)", errorPayload);
    return { stdout, stderr, exitCode };
  }
}

export async function fetchRemoteRef(ref: string | null): Promise<boolean> {
  if (!ref) {
    return false;
  }
  const trimmedRef = ref.trim();
  if (!trimmedRef) {
    return false;
  }

  const remoteBranch = trimmedRef.replace(/^origin\//, "");
  const verifyRef = `refs/remotes/origin/${remoteBranch}`;
  const fetchCommand = `git fetch --no-tags --prune origin refs/heads/${remoteBranch}:${verifyRef}`;

  log("DEBUG", "Fetching remote ref", { ref: trimmedRef, remoteBranch });

  const result = await runGitCommand(fetchCommand, true);

  if (!result) {
    log("WARN", "git fetch failed for ref", { ref: trimmedRef });
    return false;
  }

  const trimmedStdout = result.stdout?.trim();
  if (trimmedStdout && trimmedStdout.length > 0) {
    log("DEBUG", "git fetch output", {
      ref: trimmedRef,
      output: trimmedStdout.slice(0, 160),
    });
  }

  const verifyResult = await runGitCommand(
    `git rev-parse --verify --quiet ${verifyRef}`,
    true,
  );

  if (verifyResult?.stdout?.trim()) {
    log("INFO", "Remote ref verified", {
      ref: trimmedRef,
      commit: verifyResult.stdout.trim(),
    });
    return true;
  }

  log("WARN", "Remote ref missing after fetch", { ref: trimmedRef });
  return false;
}

function formatDiff(diff: string): string {
  if (!diff) return "No changes detected";
  const trimmed = diff.trim();
  if (trimmed.length === 0) return "No changes detected";
  return trimmed;
}

export async function collectDiffForRun(
  baseBranch: string,
  branch: string | null,
): Promise<string> {
  if (!branch) {
    return "No changes detected";
  }

  const sanitizedBase = baseBranch || "main";
  log("INFO", "Collecting diff from remote branches", {
    baseBranch: sanitizedBase,
    branch,
  });

  await fetchRemoteRef(sanitizedBase);
  await fetchRemoteRef(branch);

  const baseRef = sanitizedBase.startsWith("origin/")
    ? sanitizedBase
    : `origin/${sanitizedBase}`;
  const branchRef = branch.startsWith("origin/") ? branch : `origin/${branch}`;

  try {
    const { stdout } = await execAsync(
      "/usr/local/bin/cmux-collect-crown-diff.sh",
      {
        cwd: WORKSPACE_ROOT,
        maxBuffer: 5 * 1024 * 1024,
        env: {
          ...process.env,
          CMUX_DIFF_BASE: baseRef,
          CMUX_DIFF_HEAD_REF: branchRef,
        },
      },
    );

    const diff = stdout.trim();
    if (!diff) {
      log("INFO", "No differences found between branches", {
        base: baseRef,
        branch: branchRef,
      });
      return "No changes detected";
    }

    return formatDiff(diff);
  } catch (error) {
    log("ERROR", "Failed to collect diff for run", {
      baseBranch: sanitizedBase,
      branch,
      error,
    });
    return "No changes detected";
  }
}

export async function ensureBranchesAvailable(
  completedRuns: Array<{ id: string; newBranch: string | null }>,
  baseBranch: string,
): Promise<boolean> {
  const sanitizedBase = baseBranch || "main";
  const baseOk = await fetchRemoteRef(sanitizedBase);
  log("INFO", "Ensuring branches available", {
    baseBranch: sanitizedBase,
    baseOk,
    completedRunCount: completedRuns.length,
  });
  let allBranchesOk = true;
  for (const run of completedRuns) {
    if (!run.newBranch) {
      log("ERROR", "Run missing branch name", { runId: run.id });
      return false;
    }
    const branchOk = await fetchRemoteRef(run.newBranch);
    log("INFO", "Checked branch availability", {
      runId: run.id,
      branch: run.newBranch,
      branchOk,
    });
    if (!branchOk) {
      allBranchesOk = false;
    }
  }
  return baseOk && allBranchesOk;
}

export async function captureRelevantDiff(): Promise<string> {
  try {
    const gitPath = await detectGitRepoPath();
    const { stdout } = await execAsync(
      "/usr/local/bin/cmux-collect-relevant-diff.sh",
      {
        cwd: gitPath,
        maxBuffer: 5 * 1024 * 1024,
      },
    );
    const diff = stdout ? stdout.trim() : "";
    return diff.length > 0 ? diff : "No changes detected";
  } catch (error) {
    log("ERROR", "Failed to collect relevant diff", { error });
    return "No changes detected";
  }
}

export function buildCommitMessage({
  prompt,
  agentName,
}: {
  prompt: string;
  agentName: string;
}): string {
  const baseLine = prompt.trim().split("\n")[0] ?? "task";
  const subject =
    baseLine.length > 60 ? `${baseLine.slice(0, 57)}...` : baseLine;
  const sanitizedAgent = agentName.replace(/[^a-zA-Z0-9_-]/g, "-");
  return `chore(${sanitizedAgent}): ${subject}`;
}

export async function getCurrentBranch(): Promise<string | null> {
  const result = await runGitCommand("git rev-parse --abbrev-ref HEAD", true);
  const branch = result?.stdout.trim();
  if (!branch) {
    log("WARN", "Unable to determine current git branch");
    return null;
  }
  return branch;
}

async function ensureGitRepository(gitPath: string): Promise<boolean> {
  const gitCheck = await runGitCommand("git rev-parse --git-dir", true);
  if (gitCheck && gitCheck.exitCode === 0) {
    return true;
  }

  log("WARN", "Not in a git repository, initializing", { gitPath });
  const initResult = await runGitCommand("git init", true);
  if (!initResult || initResult.exitCode !== 0) {
    log("ERROR", "Failed to initialize git repository", {
      gitPath,
      error: initResult?.stderr,
    });
    return false;
  }

  log("INFO", "Initialized git repository", { gitPath });
  return true;
}

async function configureRemote(remoteUrl: string): Promise<void> {
  const currentRemote = await runGitCommand("git remote get-url origin", true);
  const currentUrl = currentRemote?.stdout.trim();

  if (!currentUrl) {
    log("INFO", "Adding origin remote", { remoteUrl });
    await runGitCommand(`git remote add origin ${remoteUrl}`);
  } else if (currentUrl !== remoteUrl) {
    log("INFO", "Updating origin remote", {
      currentRemote: currentUrl,
      remoteUrl,
    });
    await runGitCommand(`git remote set-url origin ${remoteUrl}`);
  }

  const updatedRemote = await runGitCommand("git remote -v", true);
  if (updatedRemote) {
    log("INFO", "Current git remotes", {
      remotes: updatedRemote.stdout.trim().split("\n"),
    });
  }
}

function truncateOutput(output: string | undefined, length = 200): string {
  return output ? output.trim().slice(0, length) : "";
}

async function stageAndCommitChanges(
  branchName: string,
  commitMessage: string
): Promise<void> {
  await runGitCommand("git add -A");
  log("INFO", "Staged all changes");

  await runGitCommand(`git checkout -B ${branchName}`);
  log("INFO", "Checked out branch", { branchName });

  const status = await runGitCommand("git status --short", true);
  const hasChanges = Boolean(status?.stdout.trim());

  if (status) {
    const lines = status.stdout.trim().split("\n");
    log("INFO", "Git status before commit", {
      branchName,
      entries: lines.slice(0, 10),
      totalLines: status.stdout.trim() === "" ? 0 : lines.length,
    });
  }

  if (!hasChanges) {
    log("INFO", "No changes to commit", { branchName });
    return;
  }

  const commitResult = await runGitCommand(
    `git commit -m ${JSON.stringify(commitMessage)}`,
    true
  );

  if (commitResult) {
    log("INFO", "Created commit", {
      branchName,
      stdout: truncateOutput(commitResult.stdout),
      stderr: truncateOutput(commitResult.stderr),
    });
  } else {
    log("WARN", "Commit command did not produce output", { branchName });
  }
}

async function syncWithRemote(branchName: string): Promise<void> {
  const remoteExists = await runGitCommand(
    `git ls-remote --heads origin ${branchName}`,
    true
  );

  if (remoteExists?.stdout.trim()) {
    log("INFO", "Remote branch exists, rebasing", {
      branchName,
      remoteHead: remoteExists.stdout.trim().slice(0, 120),
    });

    const pullResult = await runGitCommand(
      `git pull --rebase origin ${branchName}`
    );

    if (pullResult) {
      log("INFO", "Rebased branch onto remote", {
        branchName,
        stdout: truncateOutput(pullResult.stdout),
        stderr: truncateOutput(pullResult.stderr),
      });
    }
  } else {
    log("INFO", "Remote branch does not exist, will create", { branchName });
  }
}

export async function autoCommitAndPush({
  branchName,
  commitMessage,
  remoteUrl,
}: {
  branchName: string;
  commitMessage: string;
  remoteUrl?: string;
}): Promise<void> {
  if (!branchName) {
    log("ERROR", "Missing branch name for auto-commit");
    return;
  }

  log("INFO", "Auto-commit starting", {
    branchName,
    commitMessage: commitMessage.slice(0, 100),
    remoteUrl,
  });

  const gitPath = await detectGitRepoPath();

  const isRepo = await ensureGitRepository(gitPath);
  if (!isRepo) {
    return;
  }

  if (remoteUrl) {
    await configureRemote(remoteUrl);
  }

  await stageAndCommitChanges(branchName, commitMessage);
  await syncWithRemote(branchName);

  log("INFO", "Pushing to remote", {
    branchName,
    command: `git push -u origin ${branchName}`,
  });

  const pushResult = await runGitCommand(`git push -u origin ${branchName}`);

  if (pushResult) {
    log("INFO", "Push completed", {
      branchName,
      exitCode: pushResult.exitCode,
      stdout: truncateOutput(pushResult.stdout),
      stderr: truncateOutput(pushResult.stderr),
    });
  }

  log("INFO", "Auto-commit finished successfully", {
    branchName,
    exitCode: pushResult?.exitCode,
  });
}

