import type { ReplaceDiffEntry } from "@cmux/shared/diff-types";
import { promises as fs } from "node:fs";
import { RepositoryManager } from "../repositoryManager.js";
import { getProjectPaths } from "../workspace.js";
import { computeEntriesBetweenRefs } from "./parseGitDiff.js";
import { getGitImplMode, loadNativeGit } from "../native/git.js";

export interface CompareRefsArgs {
  ref1: string;
  ref2: string;
  repoFullName?: string; // e.g., owner/name
  repoUrl?: string; // optional explicit remote
  teamSlugOrId?: string; // required if repoUrl provided without originPathOverride
  originPathOverride?: string; // bypass clone/ensure and use this local repo path directly
}

export async function compareRefsForRepo(
  args: CompareRefsArgs
): Promise<ReplaceDiffEntry[]> {
  const { ref1, ref2, originPathOverride } = args;

  // Prefer Rust native implementation up front to avoid JS-only requirements
  const impl = getGitImplMode();
  if (impl === "rust") {
    const native = loadNativeGit();
    if (native?.gitDiffRefs) {
      try {
        return await native.gitDiffRefs({
          ref1,
          ref2,
          repoUrl: args.repoUrl,
          repoFullName: args.repoFullName,
          teamSlugOrId: args.teamSlugOrId,
          originPathOverride: args.originPathOverride,
          includeContents: true,
        });
      } catch {
        // fallthrough to JS
      }
    }
  }

  let originPath: string;
  if (originPathOverride) {
    originPath = originPathOverride;
  } else {
    const repoUrl =
      args.repoUrl ??
      (args.repoFullName
        ? `https://github.com/${args.repoFullName}.git`
        : undefined);
    if (!repoUrl) throw new Error("repoUrl or repoFullName is required");
    if (!args.teamSlugOrId)
      throw new Error(
        "teamSlugOrId is required when not using originPathOverride"
      );

    const projectPaths = await getProjectPaths(repoUrl, args.teamSlugOrId);
    await fs.mkdir(projectPaths.projectPath, { recursive: true });
    await fs.mkdir(projectPaths.worktreesPath, { recursive: true });

    const repoManager = RepositoryManager.getInstance();
    await repoManager.ensureRepository(repoUrl, projectPaths.originPath);
    // Attempt to fetch/pull both refs best-effort
    async function fetchRefGeneric(ref: string): Promise<void> {
      // Quick presence check
      const hasRef = await repoManager
        .executeGitCommand(`git rev-parse --verify --quiet ${ref}`, {
          cwd: projectPaths.originPath,
          suppressErrorLogging: true,
        })
        .then(() => true)
        .catch(() => false);
      if (hasRef) return;
      // Try as branch
      await repoManager
        .executeGitCommand(
          `git fetch --depth 1 origin +refs/heads/${ref}:refs/remotes/origin/${ref}`,
          { cwd: projectPaths.originPath, suppressErrorLogging: true }
        )
        .catch(() => undefined);
      const hasBranch = await repoManager
        .executeGitCommand(`git rev-parse --verify --quiet ${ref}`, {
          cwd: projectPaths.originPath,
          suppressErrorLogging: true,
        })
        .then(() => true)
        .catch(() => false);
      if (hasBranch) return;
      // Try as tag
      await repoManager
        .executeGitCommand(
          `git fetch --depth 1 origin +refs/tags/${ref}:refs/tags/${ref}`,
          { cwd: projectPaths.originPath, suppressErrorLogging: true }
        )
        .catch(() => undefined);
      const hasTag = await repoManager
        .executeGitCommand(`git rev-parse --verify --quiet ${ref}`, {
          cwd: projectPaths.originPath,
          suppressErrorLogging: true,
        })
        .then(() => true)
        .catch(() => false);
      if (hasTag) return;
      // Fallback: generic fetch
      await repoManager
        .executeGitCommand(`git fetch --depth 1 origin ${ref}`, {
          cwd: projectPaths.originPath,
          suppressErrorLogging: true,
        })
        .catch(() => undefined);
    }

    await Promise.allSettled([fetchRefGeneric(ref1), fetchRefGeneric(ref2)]);
    originPath = projectPaths.originPath;
  }

  // Resolve both refs to commit-ish that exist in the local clone (JS fallback)
  const repoMgr = RepositoryManager.getInstance();
  const resolveCommitish = async (
    repoPath: string,
    ref: string
  ): Promise<string> => {
    const candidates = [
      ref,
      `origin/${ref}`,
      `refs/remotes/origin/${ref}`,
      `refs/tags/${ref}`,
    ];
    for (const cand of candidates) {
      const ok = await repoMgr
        .executeGitCommand(`git rev-parse --verify --quiet ${cand}^{commit}`, {
          cwd: repoPath,
          suppressErrorLogging: true,
        })
        .then(() => true)
        .catch(() => false);
      if (ok) return cand;
    }
    throw new Error(
      `Unknown ref '${ref}'. Ensure it exists (e.g., 'origin/${ref}') or push the branch.`
    );
  };

  const [resolved1, resolved2] = await Promise.all([
    resolveCommitish(originPath, ref1),
    resolveCommitish(originPath, ref2),
  ]);

  const entries = await computeEntriesBetweenRefs({
    repoPath: originPath,
    ref1: resolved1,
    ref2: resolved2,
    includeContents: true,
  });
  return entries;
}
