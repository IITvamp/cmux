import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { ReplaceDiffEntry } from "@cmux/shared/diff-types";
import { RepositoryManager } from "../repositoryManager.js";
import { serverLogger } from "../utils/fileLogger.js";
import { getProjectPaths } from "../workspace.js";
import { computeEntriesBetweenRefs } from "./parseGitDiff.js";

export interface CompareRefsArgs {
  ref1: string;
  ref2: string;
  repoFullName?: string; // e.g., owner/name
  repoUrl?: string; // optional explicit remote
  teamSlugOrId?: string; // required if repoUrl provided without originPathOverride
  originPathOverride?: string; // bypass clone/ensure and use this local repo path directly
}

export async function compareRefsForRepo(args: CompareRefsArgs): Promise<ReplaceDiffEntry[]> {
  const { ref1, ref2, originPathOverride } = args;

  let originPath: string;
  if (originPathOverride) {
    originPath = originPathOverride;
  } else {
    const repoUrl = args.repoUrl ?? (args.repoFullName ? `https://github.com/${args.repoFullName}.git` : undefined);
    if (!repoUrl) throw new Error("repoUrl or repoFullName is required");
    if (!args.teamSlugOrId) throw new Error("teamSlugOrId is required when not using originPathOverride");

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

  const entries = await computeEntriesBetweenRefs({
    repoPath: originPath,
    ref1,
    ref2,
    includeContents: true,
  });
  return entries;
}
