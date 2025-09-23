import type { ReplaceDiffEntry } from "@cmux/shared/diff-types";
import { loadNativeGit } from "../native/git.js";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return String(error);
}

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
    const message = toErrorMessage(e);
    throw new Error(`Native gitDiffRefs failed: ${message}`, { cause: e });
  }
}
