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

  const t0 = Date.now();
  const ensured = await ensureRunWorktreeAndBranch(taskRunId, teamSlugOrId);
  const tEnsure = Date.now();
  const worktreePath = ensured.worktreePath;

  const entries = await computeEntriesNodeGit({
    worktreePath,
    includeContents,
  });
  const tCompute = Date.now();

  // Start watching this worktree to push reactive updates to connected clients, if available
  let watchStarted = false;
  if (rt) {
    try {
      void gitDiffManager.watchWorkspace(worktreePath, () => {
        rt.emit("git-file-changed", {
          workspacePath: worktreePath,
          filePath: "",
        });
      });
      watchStarted = true;
    } catch (e) {
      serverLogger.warn(`Failed to start watcher for ${worktreePath}: ${String(e)}`);
    }
  }
  const tWatch = Date.now();

  serverLogger.info(
    `[Perf][getRunDiffs] run=${String(taskRunId)} team=${teamSlugOrId} entries=${entries.length} ensureMs=${tEnsure - t0} computeMs=${tCompute - tEnsure} watchMs=${tWatch - tCompute} totalMs=${tWatch - t0} watchStarted=${watchStarted}`
  );

  return entries;
}
