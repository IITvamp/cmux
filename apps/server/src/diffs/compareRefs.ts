import type { ReplaceDiffEntry } from "@cmux/shared/diff-types";
import { loadNativeGit } from "../native/git.js";

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
  const { ref1, ref2 } = args;

  const native = loadNativeGit();
  if (!native?.gitDiffRefs) {
    throw new Error(
      "Native gitDiffRefs not available; rebuild @cmux/native-core"
    );
  }
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
  } catch (e) {
    // Check if the error is related to repository not found
    const errorMessage = e instanceof Error ? e.message : String(e);
    const causeMessage = e instanceof Error && e.cause instanceof Error ? e.cause.message : "";

    if (errorMessage.includes("repository") && errorMessage.includes("not found") ||
        causeMessage.includes("repository") && causeMessage.includes("not found") ||
        errorMessage.includes("Not Found") ||
        causeMessage.includes("Not Found")) {
      throw new Error(
        `Failed to access repository: ${args.repoUrl || args.repoFullName || "unknown"}`,
        { cause: e }
      );
    }

    // Generic fallback for other errors
    throw new Error(
      "Failed to generate diff using native git",
      { cause: e }
    );
  }
}
