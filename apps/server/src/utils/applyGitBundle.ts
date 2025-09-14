import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { promisify } from "node:util";
import { exec as _exec } from "node:child_process";
import { serverLogger } from "./fileLogger.js";

const exec = promisify(_exec);

function defaultRustCacheRoot(): string {
  if (process.env.CMUX_RUST_GIT_CACHE) return process.env.CMUX_RUST_GIT_CACHE;
  const plat = process.platform;
  const home = os.homedir();
  if (plat === "darwin") return path.join(home, "Library", "Caches", "cmux-git-cache");
  if (plat === "win32") {
    const base = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
    return path.join(base, "cmux-git-cache");
  }
  return path.join(home, ".cache", "cmux-git-cache");
}

function slugFromRepoUrl(url: string): string {
  const clean = url.replace(/\.git$/i, "");
  const parts = clean.split("/");
  if (parts.length >= 2) {
    const a = parts[parts.length - 2];
    const b = parts[parts.length - 1];
    return `${a}__${b}`;
  }
  return clean.replace(/[/:@\\]/g, "_");
}

async function ensureRustCacheRepo(repoUrl: string): Promise<string> {
  const root = defaultRustCacheRoot();
  const repoPath = path.join(root, slugFromRepoUrl(repoUrl));
  try {
    await fs.mkdir(root, { recursive: true });
    // If .git not present, clone it
    try {
      await fs.access(path.join(repoPath, ".git"));
    } catch {
      serverLogger.info(`[GitBundle] Cloning cache repo: ${repoUrl} -> ${repoPath}`);
      await fs.mkdir(repoPath, { recursive: true });
      const parent = path.dirname(repoPath);
      const name = path.basename(repoPath);
      await exec(`git clone --no-single-branch "${repoUrl}" "${name}"`, { cwd: parent });
    }
  } catch (e) {
    serverLogger.warn(`[GitBundle] Failed to ensure rust cache repo:`, e);
  }
  return repoPath;
}

export async function applyGitBundle(params: {
  worktreePath: string;
  repoUrl: string;
  branch: string;
  bundleName: string;
  bundleBytes: ArrayBuffer;
}): Promise<void> {
  const { worktreePath, repoUrl, branch, bundleName, bundleBytes } = params;
  const tmpDir = path.join(os.tmpdir(), "cmux-bundles");
  await fs.mkdir(tmpDir, { recursive: true });
  const bundlePath = path.join(tmpDir, bundleName);
  await fs.writeFile(bundlePath, Buffer.from(bundleBytes));

  try {
    // Apply to worktree (updates shared repo store behind worktree)
    serverLogger.info(`[GitBundle] Fetching bundle into worktree ${worktreePath}`);
    await exec(`git fetch "${bundlePath}" HEAD:refs/heads/${branch}`, { cwd: worktreePath });
  } catch (e) {
    serverLogger.error(`[GitBundle] Failed to fetch bundle into worktree`, e);
  }

  try {
    // Apply to rust cache clone
    const cachePath = await ensureRustCacheRepo(repoUrl);
    serverLogger.info(`[GitBundle] Fetching bundle into rust cache ${cachePath}`);
    await exec(`git fetch "${bundlePath}" HEAD:refs/heads/${branch}`, { cwd: cachePath });
  } catch (e) {
    serverLogger.error(`[GitBundle] Failed to fetch bundle into rust cache`, e);
  }

  // Best-effort cleanup
  try { await fs.unlink(bundlePath); } catch { /* ignore */ }
}

