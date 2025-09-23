import type { ReplaceDiffEntry } from "@cmux/shared/diff-types";
import { loadNativeGit } from "../native/git.js";

const repoNotFoundMatchers: Array<(value: string) => boolean> = [
  (value) => value.includes("remote: not found"),
  (value) => value.includes("fatal: repository"),
  (value) => value.includes("repository") && value.includes("not found"),
];

function listErrorMessages(error: unknown): string[] {
  const messages: string[] = [];
  const visited = new Set<object>();

  const enqueue = (value: unknown) => {
    if (typeof value === "string" && value.trim() !== "") {
      messages.push(value);
    }
  };

  let current: unknown = error;
  while (typeof current === "object" && current !== null) {
    if (visited.has(current)) {
      break;
    }
    visited.add(current);

    if (current instanceof Error) {
      enqueue(current.message);
      const maybeCause = (current as Error & { cause?: unknown }).cause;
      current = maybeCause;
      continue;
    }

    const maybeMessage = (current as { message?: unknown }).message;
    if (typeof maybeMessage === "string") {
      enqueue(maybeMessage);
    }
    break;
  }

  if (messages.length === 0) {
    enqueue(String(error));
  }

  return messages.map((value) => value.toLowerCase());
}

function inferRepoNotFound(error: unknown): boolean {
  const messages = listErrorMessages(error);
  return messages.some((message) =>
    repoNotFoundMatchers.some((matcher) => matcher(message))
  );
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
  } catch (error) {
    const repoIdentifier =
      args.originPathOverride ?? args.repoFullName ?? args.repoUrl ?? "repository";
    const baseMessage = inferRepoNotFound(error)
      ? `Failed to compare refs: ${repoIdentifier} not found or inaccessible`
      : "Failed to compare refs using native gitDiffRefs";

    throw new Error(baseMessage, { cause: error });
  }
}
