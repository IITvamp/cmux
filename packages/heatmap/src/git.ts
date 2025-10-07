import { spawn } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { HeatmapError } from "./errors.js";

interface RunGitOptions {
  readonly cwd?: string;
  readonly trim?: boolean;
}

export async function runGit(
  args: readonly string[],
  options: RunGitOptions = {}
): Promise<string> {
  const { cwd, trim = true } = options;

  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(
        new HeatmapError(
          `Failed to start git for command: git ${args.join(" ")}. ${error.message}`,
          "GIT",
          { cause: error }
        )
      );
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(trim ? stdout.trim() : stdout);
        return;
      }

      reject(
        new HeatmapError(
          [
            `git ${args.join(" ")}`,
            stderr.trim() !== "" ? stderr.trim() : undefined,
          ]
            .filter(Boolean)
            .join("\n"),
          "GIT"
        )
      );
    });
  });
}

export interface ClonedRepository {
  readonly path: string;
  readonly cleanup: () => Promise<void>;
}

export async function cloneRepository(remote: string): Promise<ClonedRepository> {
  const baseDir = await mkdtemp(path.join(tmpdir(), "cmux-heatmap-"));
  const repoPath = path.join(baseDir, "repo");

  try {
    await runGit(["clone", remote, repoPath]);
  } catch (error) {
    throw new HeatmapError(
      `Unable to clone repository ${remote}. ${error instanceof Error ? error.message : String(error)}`,
      "GIT",
      error instanceof Error ? { cause: error } : undefined
    );
  }

  return {
    path: repoPath,
    cleanup: async () => {
      await rm(baseDir, { recursive: true, force: true });
    },
  };
}

export async function ensureGitDirectory(directory: string): Promise<void> {
  try {
    const stats = await stat(directory);
    if (!stats.isDirectory()) {
      throw new HeatmapError(
        `Path ${directory} is not a directory.`,
        "INPUT_VALIDATION"
      );
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new HeatmapError(
        `Directory ${directory} does not exist.`,
        "INPUT_VALIDATION"
      );
    }
    if (error instanceof HeatmapError) {
      throw error;
    }
    throw new HeatmapError(
      `Unable to access directory ${directory}.`,
      "INPUT_VALIDATION",
      error instanceof Error ? { cause: error } : undefined
    );
  }

  try {
    await runGit(["rev-parse", "--is-inside-work-tree"], { cwd: directory });
  } catch (error) {
    throw new HeatmapError(
      `Directory ${directory} is not a git repository.`,
      "INPUT_VALIDATION",
      error instanceof Error ? { cause: error } : undefined
    );
  }
}

export async function detectDefaultRemoteBranch(
  repoPath: string
): Promise<string> {
  let output: string;
  try {
    output = await runGit(["remote", "show", "origin"], { cwd: repoPath });
  } catch (error) {
    throw new HeatmapError(
      "Unable to determine default branch from remote 'origin'. Provide a base ref explicitly.",
      "INPUT_VALIDATION",
      error instanceof Error ? { cause: error } : undefined
    );
  }

  const match = /HEAD branch: ([^\n]+)/.exec(output);
  if (match && match[1]) {
    return match[1].trim();
  }

  throw new HeatmapError(
    "Remote 'origin' does not expose a HEAD branch. Provide a base ref explicitly.",
    "INPUT_VALIDATION"
  );
}

export interface ResolvedRef {
  readonly commit: string;
  readonly canonicalRef: string;
}

export async function resolveCommit(
  repoPath: string,
  ref: string
): Promise<ResolvedRef> {
  const candidates = new Set<string>();
  candidates.add(ref);
  if (!ref.startsWith("refs/") && !ref.startsWith("origin/")) {
    candidates.add(`origin/${ref}`);
  }

  for (const candidate of candidates) {
    try {
      const commit = await runGit(["rev-parse", candidate], { cwd: repoPath });
      return { commit: commit.trim(), canonicalRef: candidate };
    } catch {
      // try next candidate
    }
  }

  const fetchTarget = ref.startsWith("origin/") ? ref.slice("origin/".length) : ref;
  try {
    await runGit(["fetch", "origin", fetchTarget], { cwd: repoPath });
  } catch (error) {
    throw new HeatmapError(
      `Unable to fetch ref ${ref} from origin.`,
      "GIT",
      error instanceof Error ? { cause: error } : undefined
    );
  }

  for (const candidate of candidates) {
    try {
      const commit = await runGit(["rev-parse", candidate], { cwd: repoPath });
      return { commit: commit.trim(), canonicalRef: candidate };
    } catch {
      // continue
    }
  }

  try {
    const commit = await runGit(["rev-parse", "FETCH_HEAD"], { cwd: repoPath });
    return { commit: commit.trim(), canonicalRef: ref };
  } catch (error) {
    throw new HeatmapError(
      `Unable to resolve ref ${ref} after fetching from origin.`,
      "GIT",
      error instanceof Error ? { cause: error } : undefined
    );
  }
}

export async function listChangedFiles(
  repoPath: string,
  baseCommit: string,
  targetCommit: string
): Promise<string[]> {
  const output = await runGit(
    ["diff", "--name-only", "--diff-filter=ACDMRT", baseCommit, targetCommit],
    { cwd: repoPath }
  );

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

export async function getFileDiff(
  repoPath: string,
  baseCommit: string,
  targetCommit: string,
  filePath: string
): Promise<string | null> {
  const diff = await runGit(
    [
      "diff",
      "--no-color",
      "--unified=8",
      baseCommit,
      targetCommit,
      "--",
      filePath,
    ],
    { cwd: repoPath, trim: false }
  );

  if (diff.trim() === "") {
    return null;
  }

  if (/^Binary files /m.test(diff)) {
    return null;
  }

  return diff;
}
