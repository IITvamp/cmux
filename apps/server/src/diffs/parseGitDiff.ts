import { promises as fs } from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";
import { exec } from "node:child_process";
import type { ReplaceDiffEntry, DiffStatus } from "@cmux/shared/diff-types";
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

  // Determine if repo has a HEAD commit
  const hasHead = await hasHeadCommit(worktreePath);

  // Collect tracked changes vs HEAD (if present)
  const tracked = await getTrackedChanges(worktreePath, hasHead);

  // Collect untracked files
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
      // additions/deletions via numstat; binary shows '-'
      const nd = await gitNumstatForFile(worktreePath, fp);
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
          // old content from HEAD
          if (hasHead && status !== "added") {
            oldContent = await gitShowFile(worktreePath, fp).catch(() => "");
          } else {
            oldContent = "";
          }
        }

        // patch text (omit for very large)
        const p = await gitPatchForFile(worktreePath, fp);
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

async function hasHeadCommit(cwd: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync("git rev-parse --verify HEAD", { cwd });
    return Boolean(stdout.trim());
  } catch {
    return false;
  }
}

async function getTrackedChanges(cwd: string, hasHead: boolean): Promise<{
  status: DiffStatus;
  filePath: string;
  oldPath?: string;
}[]> {
  if (!hasHead) return [];
  // name-status with renames, NUL-delimited
  const { stdout } = await execAsync("git diff --name-status -z --find-renames HEAD", { cwd });
  const bytes = stdout;
  const parts = bytes.split("\0").filter(Boolean);
  const items: { status: DiffStatus; filePath: string; oldPath?: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i]!;
    const fields = entry.split("\t");
    const code = fields[0]!; // e.g., M, A, D, R100
    if (code.startsWith("R")) {
      // Next part after this line contains the new path if not included
      const oldPath = fields[1] ?? parts[++i];
      const newPath = fields[2] ?? parts[i + 0];
      if (!oldPath || !newPath) continue;
      items.push({ status: "renamed", filePath: newPath, oldPath });
    } else {
      const fp = fields[1] ?? parts[++i];
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

async function gitNumstatForFile(cwd: string, filePath: string): Promise<{ additions: number; deletions: number; isBinary: boolean } | null> {
  try {
    const { stdout } = await execAsync(`git diff --numstat -- "${escapePath(filePath)}"`, { cwd });
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

async function gitPatchForFile(cwd: string, filePath: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`git diff --patch --binary --no-color -- "${escapePath(filePath)}"`, { cwd, maxBuffer: 10 * 1024 * 1024 });
    return stdout || null;
  } catch {
    return null;
  }
}

async function gitShowFile(cwd: string, filePath: string): Promise<string> {
  const { stdout } = await execAsync(`git show HEAD:"${escapePath(filePath)}"`, { cwd, maxBuffer: 10 * 1024 * 1024 });
  return stdout;
}

function escapePath(p: string): string {
  return p.replace(/"/g, '\\"');
}
