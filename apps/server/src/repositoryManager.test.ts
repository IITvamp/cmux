import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";
import { RepositoryManager } from "./repositoryManager.js";

const exec = promisify(execCb);

interface RepoCase {
  url: string;
  defaultBranch: string;
}

const REPOS: RepoCase[] = [
  { url: "https://github.com/sindresorhus/is.git", defaultBranch: "main" },
  { url: "https://github.com/tj/commander.js.git", defaultBranch: "master" },
  { url: "https://github.com/stack-auth/stack-auth.git", defaultBranch: "dev" },
];

const TEST_BASE = path.join(tmpdir(), `cmux-repo-tests-${Date.now()}`);

async function gitDirExists(dir: string): Promise<boolean> {
  try {
    await fs.access(path.join(dir, ".git"));
    return true;
  } catch {
    return false;
  }
}

async function getHeadBranch(cwd: string): Promise<string> {
  const { stdout } = await exec("git rev-parse --abbrev-ref HEAD", { cwd });
  return stdout.trim();
}

describe.sequential("RepositoryManager branch behavior (no fallbacks)", () => {
  beforeAll(async () => {
    try {
      const { stdout } = await exec("which git");
      const gitPath = stdout.trim();
      if (gitPath) process.env.GIT_PATH = gitPath;
    } catch {
      process.env.GIT_PATH = "git";
    }
    await fs.mkdir(TEST_BASE, { recursive: true });
  });

  afterAll(async () => {
    // Best-effort cleanup: remove any worktrees first, then delete base dir
    try {
      const entries = await fs.readdir(TEST_BASE);
      for (const entry of entries) {
        const projectPath = path.join(TEST_BASE, entry);
        const originPath = path.join(projectPath, "origin");
        try {
          // List worktrees and force-remove
          const { stdout } = await exec("git worktree list --porcelain", {
            cwd: originPath,
          });
          const matches = Array.from(
            stdout.matchAll(/^worktree\s+(.*)$/gm)
          ).map((m) => m[1]);
          for (const wt of matches) {
            if (path.resolve(wt).startsWith(path.resolve(projectPath))) {
              await exec(`git worktree remove --force "${wt}"`, {
                cwd: originPath,
              }).catch(() => {});
            }
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    } finally {
      await fs.rm(TEST_BASE, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("clones and checks out specified existing branches", async () => {
    const mgr = RepositoryManager.getInstance({ fetchDepth: 1 });

    for (const repo of REPOS) {
      const projectDir = path.join(
        TEST_BASE,
        repo.url.split("/").pop()!.replace(/\.git$/, "")
      );
      const originPath = path.join(projectDir, "origin");
      await fs.mkdir(projectDir, { recursive: true });

      await mgr.ensureRepository(repo.url, originPath, repo.defaultBranch);

      expect(await gitDirExists(originPath)).toBe(true);
      expect(await getHeadBranch(originPath)).toBe(repo.defaultBranch);
    }
  }, 120_000);

  it("throws when switching to a non-existent branch", async () => {
    const mgr = RepositoryManager.getInstance({ fetchDepth: 1 });
    const repo = REPOS[0]; // use a stable repo
    const projectDir = path.join(TEST_BASE, "non-existent-branch");
    const originPath = path.join(projectDir, "origin");
    await fs.mkdir(projectDir, { recursive: true });

    // First ensure repo exists on a valid branch
    await mgr.ensureRepository(repo.url, originPath, repo.defaultBranch);

    // Now request a non-existent branch – should reject
    await expect(
      mgr.ensureRepository(repo.url, originPath, "this-branch-should-not-exist")
    ).rejects.toBeTruthy();
  }, 90_000);

  it("creates worktrees from a valid base and errors for missing base", async () => {
    const mgr = RepositoryManager.getInstance({ fetchDepth: 1 });
    const repo = REPOS[2]; // stack-auth with dev default
    const projectDir = path.join(TEST_BASE, "worktree-tests");
    const originPath = path.join(projectDir, "origin");
    await fs.mkdir(projectDir, { recursive: true });

    await mgr.ensureRepository(repo.url, originPath, repo.defaultBranch);

    const okWorktree = path.join(projectDir, "worktrees", "ok-branch");
    await fs.mkdir(path.dirname(okWorktree), { recursive: true });
    await mgr.createWorktree(originPath, okWorktree, "cmux-ok", repo.defaultBranch);
    // Worktree path directory should exist now
    const exists = await fs
      .access(okWorktree)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);

    const badWorktree = path.join(projectDir, "worktrees", "bad-branch");
    await expect(
      mgr.createWorktree(
        originPath,
        badWorktree,
        "cmux-bad",
        "this-branch-should-not-exist"
      )
    ).rejects.toThrow(/Base branch 'origin\/this-branch-should-not-exist' not found/i);
  }, 120_000);

it("handles non-default 'main' branch for stack-auth and can create worktree from it", async () => {
    // Skip in environments where shell/git cannot be invoked
    try {
      await exec("git --version");
    } catch {
      console.warn("Skipping 'stack-auth main' test: 'git --version' failed in this environment");
      return;
    }
    const mgr = RepositoryManager.getInstance({ fetchDepth: 1 });
    const repo = REPOS.find(r => r.url.includes("stack-auth/stack-auth.git"))!;
    const projectDir = path.join(TEST_BASE, "stack-auth-main-case");
    const originPath = path.join(projectDir, "origin");
    await fs.mkdir(projectDir, { recursive: true });

    // Ensure directly on 'main' (not default)
    await mgr.ensureRepository(repo.url, originPath, "main");
    expect(await getHeadBranch(originPath)).toBe("main");

    // Create a worktree based on main
    const wt = path.join(projectDir, "worktrees", "from-main");
    await fs.mkdir(path.dirname(wt), { recursive: true });
    await mgr.createWorktree(originPath, wt, "cmux-from-main", "main");
    const exists = await fs
      .access(wt)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  }, 120_000);

  it("detects remote default branches when no branch specified", async () => {
    const mgr = RepositoryManager.getInstance({ fetchDepth: 1 });

    for (const repo of REPOS) {
      const projectDir = path.join(
        TEST_BASE,
        `default-branch-${repo.defaultBranch}-${repo.url.split("/").pop()!.replace(/\.git$/, "")}`
      );
      const originPath = path.join(projectDir, "origin");
      await fs.mkdir(projectDir, { recursive: true });

      await mgr.ensureRepository(repo.url, originPath);
      const detected = await mgr.getDefaultBranch(originPath);
      expect([repo.defaultBranch, "develop"]).toContain(detected);
    }
  }, 120_000);
});
