import type { Id } from "@cmux/convex/dataModel";
import type { ReplaceDiffEntry } from "@cmux/shared/diff-types";
import { GitDiffManager } from "../gitDiff.js";
import { loadNativeGit } from "../native/git.js";
import type { RealtimeServer } from "../realtime.js";
import { ensureRunWorktreeAndBranch } from "../utils/ensureRunWorktree.js";
import { serverLogger } from "../utils/fileLogger.js";
// Stop using workspace diff; we rely on native ref diff.

export interface GetRunDiffsOptions {
  taskRunId: Id<"taskRuns">;
  teamSlugOrId: string;
  gitDiffManager: GitDiffManager;
  rt?: RealtimeServer;
  includeContents?: boolean;
  perfOut?: GetRunDiffsPerf;
}

export type GetRunDiffsPerf = {
  ensureMs: number;
  computeMs: number;
  watchMs: number;
  totalMs: number;
  watchStarted: boolean;
};

export async function getRunDiffs(
  options: GetRunDiffsOptions
): Promise<ReplaceDiffEntry[]> {
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

  const native = loadNativeGit();
  if (!native?.gitDiffRefs) {
    throw new Error("Native git diff not available; rebuild @cmux/native-time");
  }
  const entries: ReplaceDiffEntry[] = await native.gitDiffRefs({
    ref1: ensured.baseBranch,
    ref2: ensured.branchName,
    repoFullName: ensured.task.projectFullName || undefined,
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
      serverLogger.warn(
        `Failed to start watcher for ${worktreePath}: ${String(e)}`
      );
    }
  }
  const tWatch = Date.now();

  if (options.perfOut) {
    options.perfOut.ensureMs = tEnsure - t0;
    options.perfOut.computeMs = tCompute - tEnsure;
    options.perfOut.watchMs = tWatch - tCompute;
    options.perfOut.totalMs = tWatch - t0;
    options.perfOut.watchStarted = watchStarted;
  }

  serverLogger.info(
    `[Perf][getRunDiffs] run=${String(taskRunId)} team=${teamSlugOrId} entries=${entries.length} ensureMs=${tEnsure - t0} computeMs=${tCompute - tEnsure} watchMs=${tWatch - tCompute} totalMs=${tWatch - t0} watchStarted=${watchStarted}`
  );

  return entries;
}
