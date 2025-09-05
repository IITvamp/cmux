import { promises as fs } from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";
import { exec } from "node:child_process";
import type { ReplaceDiffEntry, DiffStatus } from "@cmux/shared/diff-types";
import { RepositoryManager } from "../repositoryManager.js";
import { serverLogger } from "../utils/fileLogger.js";

export interface ParsedDiffOptions {
  worktreePath: string;
  // If true, try to include file contents when under size limit
  includeContents?: boolean;
  // Max total size for patch + contents before omitting
  maxBytes?: number;
}

// NodeGit-only version: compute diff entries against HEAD and workdir (including index and untracked)
const execAsync = promisify(exec);

export async function computeEntriesNodeGit(opts: ParsedDiffOptions): Promise<ReplaceDiffEntry[]> {
  const { worktreePath, includeContents = true, maxBytes = 950 * 1024 } = opts;

  // Ensure remote refs exist/are fresh to avoid missing diffs in shallow clones
  await prefetchBaseRefs(worktreePath).catch(() => {
    // best-effort; continue regardless
  });

  // Resolve a primary/base ref: prefer the repo default branch (e.g., origin/main)
  const baseRef = await resolvePrimaryBaseRef(worktreePath);
  const compareBase = await resolveMergeBaseWithDeepen(worktreePath, baseRef);

  // Collect tracked changes vs baseRef (includes committed + staged + unstaged)
  const tracked = await getTrackedChanges(worktreePath, compareBase);

  // Collect untracked files (relative to baseRef they are also additions)
  const untracked = await getUntrackedFiles(worktreePath);

  const entries: ReplaceDiffEntry[] = [];

  // Handle tracked files
  for (const t of tracked) {
    const { status, filePath: fp, oldPath } = t;
    let additions = 0;
    let deletions = 0;
    let isBinary = false;
    let patchText: string | undefined;
    let oldContent: string | undefined;
    let newContent: string | undefined;

    try {
      // additions/deletions via numstat against baseRef; binary shows '-'
      const nd = await gitNumstatForFile(worktreePath, compareBase, fp);
      if (nd) {
        additions = nd.additions;
        deletions = nd.deletions;
        isBinary = nd.isBinary;
      }

      if (!isBinary) {
        if (includeContents) {
          // new content from FS if exists
          if (status !== "deleted") {
            try {
              newContent = await fs.readFile(path.join(worktreePath, fp), "utf8");
            } catch {
              newContent = "";
            }
          }
          // old content from the effective comparison base (merge-base when available)
          if (status !== "added") {
            oldContent = await gitShowFile(worktreePath, compareBase, fp).catch(() => "");
          } else {
            oldContent = "";
          }
        }

        // patch text (omit for very large) against baseRef
        const p = await gitPatchForFile(worktreePath, compareBase, fp);
        if (p) patchText = p;
      }
    } catch (err) {
      serverLogger.warn(`[Diffs] Failed building entry for ${fp}: ${String(err)}`);
    }

    const patchSize = !isBinary && patchText ? Buffer.byteLength(patchText, "utf8") : 0;
    const oldSize = oldContent ? Buffer.byteLength(oldContent, "utf8") : 0;
    const newSize = newContent ? Buffer.byteLength(newContent, "utf8") : 0;
    const totalApprox = patchSize + oldSize + newSize;

    const base: ReplaceDiffEntry = {
      filePath: fp,
      oldPath,
      status,
      additions,
      deletions,
      isBinary,
      patchSize,
      oldSize,
      newSize,
    };

    if (!isBinary && includeContents) {
      if (totalApprox <= maxBytes) {
        base.patch = patchText;
        base.oldContent = oldContent;
        base.newContent = newContent;
        base.contentOmitted = false;
      } else {
        base.patch = patchSize < maxBytes ? patchText : undefined;
        base.contentOmitted = true;
      }
    } else {
      base.contentOmitted = false;
    }

    // Filter out noisy no-op modified entries (e.g., metadata-only) that
    // report 0/0 and have no textual patch. Keep binary and all other statuses.
    if (
      base.status === "modified" &&
      !base.isBinary &&
      base.additions === 0 &&
      base.deletions === 0 &&
      (!base.patch || base.patch.trim() === "")
    ) {
      continue;
    }

    entries.push(base);
  }

  // Handle untracked files as added
  for (const fp of untracked) {
    let newContent = "";
    try {
      newContent = await fs.readFile(path.join(worktreePath, fp), "utf8");
    } catch {
      newContent = "";
    }
    const additions = newContent ? newContent.split("\n").length : 0;
    const newSize = Buffer.byteLength(newContent, "utf8");
    const base: ReplaceDiffEntry = {
      filePath: fp,
      status: "added",
      additions,
      deletions: 0,
      isBinary: false,
      newSize,
      oldSize: 0,
      patchSize: 0,
    };
    if (includeContents && newSize <= maxBytes) {
      base.oldContent = "";
      base.newContent = newContent;
      base.contentOmitted = false;
    } else if (includeContents) {
      base.contentOmitted = true;
    } else {
      base.contentOmitted = false;
    }
    entries.push(base);
  }

  return entries;
}

async function prefetchBaseRefs(cwd: string): Promise<void> {
  const repoMgr = RepositoryManager.getInstance();
  // Fetch default branch refspec
  let defaultBranch = "main";
  try {
    defaultBranch = await repoMgr.getDefaultBranch(cwd);
  } catch {
    // ignore
  }
  try {
    await repoMgr.executeGitCommand(
      `git fetch --quiet --prune --depth 1 origin +refs/heads/${defaultBranch}:refs/remotes/origin/${defaultBranch}`,
      { cwd, suppressErrorLogging: true }
    );
  } catch {
    // ignore
  }

  // Fetch the current branch's upstream if present
  try {
    const { stdout } = await execAsync(
      "git rev-parse --abbrev-ref --symbolic-full-name @{u}",
      { cwd }
    );
    const upstreamRef = stdout.trim(); // e.g., origin/feature
    const m = upstreamRef.match(/^origin\/(.+)$/);
    const branchName = m ? m[1] : "";
    if (branchName) {
      await repoMgr.executeGitCommand(
        `git fetch --quiet --depth 1 origin +refs/heads/${branchName}:refs/remotes/origin/${branchName}`,
        { cwd, suppressErrorLogging: true }
      );
    }
  } catch {
    // ignore
  }
}

async function resolvePrimaryBaseRef(cwd: string): Promise<string> {
  // Prefer the repository default branch (e.g., origin/main)
  try {
    const repoMgr = RepositoryManager.getInstance();
    const defaultBranch = await repoMgr.getDefaultBranch(cwd);
    if (defaultBranch) return `origin/${defaultBranch}`;
  } catch (err) {
    serverLogger.debug(
      `[Diffs] Could not detect default branch for ${cwd}: ${String(
        (err as Error)?.message || err
      )}`
    );
  }
  // Fallback: use upstream only when default branch detection fails
  try {
    const { stdout } = await execAsync(
      "git rev-parse --abbrev-ref --symbolic-full-name @{u}",
      { cwd }
    );
    if (stdout.trim()) return "@{upstream}";
  } catch (err) {
    serverLogger.debug(
      `[Diffs] No upstream for ${cwd}: ${String((err as Error)?.message || err)}`
    );
  }
  // Final fallback
  return "origin/main";
}

async function resolveMergeBaseWithDeepen(cwd: string, baseRef: string): Promise<string> {
  // Try merge-base to emulate GitHub PR compare; shallow clones may need deepen
  const tryMergeBase = async (): Promise<string | null> => {
    try {
      const { stdout } = await execAsync(`git merge-base ${baseRef} HEAD`, { cwd });
      const mb = stdout.trim();
      return mb || null;
    } catch {
      return null;
    }
  };

  let mb = await tryMergeBase();
  if (mb) return mb;

  // Determine branch name to deepen if possible
  let remoteBranch = "";
  try {
    if (baseRef === "@{upstream}") {
      const { stdout } = await execAsync(
        "git rev-parse --abbrev-ref --symbolic-full-name @{u}",
        { cwd }
      );
      remoteBranch = stdout.trim(); // e.g., origin/main
    } else {
      remoteBranch = baseRef; // likely origin/<branch>
    }
  } catch {
    remoteBranch = baseRef;
  }

  const m = remoteBranch.match(/^origin\/(.+)$/);
  const branchName = m ? m[1] : "";

  // Attempt to deepen history progressively to locate a merge-base
  const depths = [50, 200, 1000];
  for (const depth of depths) {
    try {
      if (branchName) {
        await execAsync(`git fetch --deepen=${depth} origin ${branchName}`, {
          cwd,
        });
      } else {
        await execAsync(`git fetch --deepen=${depth} origin`, { cwd });
      }
    } catch {
      // ignore fetch errors; attempt merge-base anyway
    }
    mb = await tryMergeBase();
    if (mb) return mb;
  }

  // Fallback to baseRef directly when merge-base cannot be resolved
  return baseRef;
}

async function getTrackedChanges(cwd: string, baseRef: string): Promise<{
  status: DiffStatus;
  filePath: string;
  oldPath?: string;
}[]> {
  // NUL-delimited; for renames, format is: Rxxx<TAB>old<NUL>new<NUL>
  // for normal entries: M|A|D<TAB>path<NUL>
  const { stdout } = await execAsync(
    `git diff --name-status -z --find-renames ${baseRef}`,
    { cwd }
  );
  const tokens = stdout.split("\0").filter(Boolean);
  const items: { status: DiffStatus; filePath: string; oldPath?: string }[] = [];
  let i = 0;
  while (i < tokens.length) {
    const code = tokens[i++]!; // e.g., 'M', 'A', 'D', 'R100'
    if (!code) break;
    if (code.startsWith("R") || code.startsWith("C")) {
      const oldPath = tokens[i++] || "";
      const newPath = tokens[i++] || "";
      if (!oldPath || !newPath) continue;
      items.push({ status: "renamed", filePath: newPath, oldPath });
    } else {
      const fp = tokens[i++] || "";
      if (!fp) continue;
      const status: DiffStatus = code === "A" ? "added" : code === "D" ? "deleted" : "modified";
      items.push({ status, filePath: fp });
    }
  }
  return items;
}

async function getUntrackedFiles(cwd: string): Promise<string[]> {
  try {
    const { stdout } = await execAsync("git ls-files --others --exclude-standard -z", { cwd });
    return stdout.split("\0").filter(Boolean);
  } catch {
    return [];
  }
}

async function gitNumstatForFile(
  cwd: string,
  baseRef: string,
  filePath: string
): Promise<{ additions: number; deletions: number; isBinary: boolean } | null> {
  try {
    const { stdout } = await execAsync(
      `git diff --numstat ${baseRef} -- "${escapePath(filePath)}"`,
      { cwd }
    );
    // format: additions<TAB>deletions<TAB>path
    const line = stdout.split("\n").find((l) => l.trim().endsWith(`\t${filePath}`));
    if (!line) return { additions: 0, deletions: 0, isBinary: false };
    const [a, d] = line.split("\t");
    const isBinary = a === "-" || d === "-";
    return {
      additions: isBinary ? 0 : parseInt(a || "0", 10),
      deletions: isBinary ? 0 : parseInt(d || "0", 10),
      isBinary,
    };
  } catch {
    return null;
  }
}

async function gitPatchForFile(
  cwd: string,
  baseRef: string,
  filePath: string
): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      `git diff --patch --binary --no-color ${baseRef} -- "${escapePath(
        filePath
      )}"`,
      { cwd, maxBuffer: 10 * 1024 * 1024 }
    );
    return stdout || null;
  } catch {
    return null;
  }
}

async function gitShowFile(cwd: string, baseRef: string, filePath: string): Promise<string> {
  const { stdout } = await execAsync(
    `git show ${baseRef}:"${escapePath(filePath)}"`,
    { cwd, maxBuffer: 10 * 1024 * 1024 }
  );
  return stdout;
}

function escapePath(p: string): string {
  return p.replace(/"/g, '\\"');
}
