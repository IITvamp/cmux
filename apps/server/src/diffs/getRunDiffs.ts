import type { Id } from "@cmux/convex/dataModel";
import type { ReplaceDiffEntry } from "@cmux/shared/diff-types";
import { computeEntriesNodeGit } from "./parseGitDiff.js";
import { ensureRunWorktreeAndBranch } from "../utils/ensureRunWorktree.js";
import { serverLogger } from "../utils/fileLogger.js";
import type { RealtimeServer } from "../realtime.js";
import { GitDiffManager } from "../gitDiff.js";

export interface GetRunDiffsOptions {
  taskRunId: Id<"taskRuns">;
  teamSlugOrId: string;
  gitDiffManager: GitDiffManager;
  rt?: RealtimeServer;
  includeContents?: boolean;
}

export async function getRunDiffs(options: GetRunDiffsOptions): Promise<ReplaceDiffEntry[]> {
  const {
    taskRunId,
    teamSlugOrId,
    gitDiffManager,
    rt,
    includeContents = true,
  } = options;

  const ensured = await ensureRunWorktreeAndBranch(taskRunId, teamSlugOrId);
  const worktreePath = ensured.worktreePath;

  const entries = await computeEntriesNodeGit({
    worktreePath,
    includeContents,
  });

  // Start watching this worktree to push reactive updates to connected clients, if available
  if (rt) {
    try {
      void gitDiffManager.watchWorkspace(worktreePath, () => {
        rt.emit("git-file-changed", {
          workspacePath: worktreePath,
          filePath: "",
        });
      });
    } catch (e) {
      serverLogger.warn(`Failed to start watcher for ${worktreePath}: ${String(e)}`);
    }
  }

  return entries;
}

