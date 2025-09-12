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
    // fallthrough to JS
    throw new Error(
      "Native gitDiffRefs not available; rebuild @cmux/native-core",
      { cause: e }
    );
  }
}
