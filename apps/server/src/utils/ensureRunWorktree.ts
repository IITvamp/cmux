import { api } from "@cmux/convex/api";
import type { Doc, Id } from "@cmux/convex/dataModel";
import { promisify } from "node:util";
import { exec } from "node:child_process";
import * as path from "node:path";
import { convex } from "../utils/convexClient.js";
import { serverLogger } from "../utils/fileLogger.js";
import { getWorktreePath, setupProjectWorkspace } from "../workspace.js";
import { RepositoryManager } from "../repositoryManager.js";

const execAsync = promisify(exec);

export type EnsureWorktreeResult = {
  run: Doc<"taskRuns">;
  task: Doc<"tasks">;
  worktreePath: string;
  branchName: string;
  baseBranch: string;
};

function sanitizeBranchName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\/-]/g, "-");
}

export async function ensureRunWorktreeAndBranch(taskRunId: Id<"taskRuns">): Promise<EnsureWorktreeResult> {
  const run = await convex.query(api.taskRuns.get, { id: taskRunId });
  if (!run) throw new Error("Task run not found");

  const task = await convex.query(api.tasks.getById, { id: run.taskId });
  if (!task) throw new Error("Task not found");

  // Determine base branch: prefer explicit task.baseBranch; otherwise detect later
  let baseBranch = task.baseBranch || "";
  const branchName = sanitizeBranchName(
    run.newBranch || `cmux-run-${String(taskRunId).slice(-8)}`
  );

  // Ensure worktree exists
  let worktreePath = run.worktreePath;
  if (!worktreePath) {
    // Derive repo URL from task.projectFullName
    if (!task.projectFullName) {
      throw new Error("Missing projectFullName to set up worktree");
    }
    const repoUrl = `https://github.com/${task.projectFullName}.git`;
    const worktreeInfo = await getWorktreePath({ repoUrl, branch: baseBranch || undefined });
    // Override with known branch name and path
    worktreeInfo.branchName = branchName;
    worktreeInfo.worktreePath = path.join(worktreeInfo.worktreesPath, branchName);

    const res = await setupProjectWorkspace({ repoUrl, branch: baseBranch || undefined, worktreeInfo });
    if (!res.success || !res.worktreePath) {
      throw new Error(res.error || "Failed to set up worktree");
    }
    worktreePath = res.worktreePath;
    await convex.mutation(api.taskRuns.updateWorktreePath, { id: run._id, worktreePath });

    // If baseBranch wasn't specified, detect it now from the origin repo
    if (!baseBranch) {
      const repoMgr = RepositoryManager.getInstance();
      baseBranch = await repoMgr.getDefaultBranch(worktreeInfo.originPath);
    }
  }

  // If worktree already existed and baseBranch is still empty, detect from the worktree
  if (!baseBranch) {
    const repoMgr = RepositoryManager.getInstance();
    baseBranch = await repoMgr.getDefaultBranch(worktreePath);
  }

  // Ensure we're on the correct branch without discarding changes
  try {
    const { stdout } = await execAsync("git rev-parse --abbrev-ref HEAD", { cwd: worktreePath });
    const currentBranch = stdout.trim();
    if (currentBranch !== branchName) {
      try {
        await execAsync(`git checkout -b ${branchName}`, { cwd: worktreePath });
      } catch {
        await execAsync(`git checkout ${branchName}`, { cwd: worktreePath });
      }
    }
  } catch (e: unknown) {
    const err = e as { message?: string; stderr?: string };
    serverLogger.error(`[ensureRunWorktree] Failed to ensure branch: ${err?.stderr || err?.message || "unknown"}`);
    throw new Error(`Failed to ensure branch: ${err?.stderr || err?.message || "unknown"}`);
  }

  return { run, task, worktreePath, branchName, baseBranch };
}
