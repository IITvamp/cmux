import { getGlobalRpcStub } from "@/contexts/socket/rpc-boot";
import { normalizeGitRef } from "@/lib/refWithOrigin";
import { queryOptions } from "@tanstack/react-query";

export interface GitDiffQuery {
  repoFullName?: string;
  repoUrl?: string;
  originPathOverride?: string;
  headRef: string;
  baseRef?: string;
  includeContents?: boolean;
  maxBytes?: number;
  lastKnownBaseSha?: string;
  lastKnownMergeCommitSha?: string;
}

export function gitDiffQueryOptions({
  repoFullName,
  repoUrl,
  originPathOverride,
  headRef,
  baseRef,
  includeContents = true,
  maxBytes,
  lastKnownBaseSha,
  lastKnownMergeCommitSha,
}: GitDiffQuery) {
  const repoKey = repoFullName ?? repoUrl ?? originPathOverride ?? "";

  const canonicalHeadRef = normalizeGitRef(headRef) || headRef?.trim() || "";
  const canonicalBaseRef =
    normalizeGitRef(baseRef) || baseRef?.trim() || "";

  return queryOptions({
    queryKey: [
      "git-diff",
      repoKey,
      canonicalHeadRef,
      canonicalBaseRef,
      includeContents ? "with-contents" : "no-contents",
      maxBytes ?? "",
      lastKnownBaseSha ?? "",
      lastKnownMergeCommitSha ?? "",
    ],
    queryFn: async () => {
      const rpcStub = getGlobalRpcStub();
      if (!rpcStub) {
        throw new Error("RPC stub not connected");
      }

      const resp = await rpcStub.gitDiff({
        repoFullName,
        repoUrl,
        originPathOverride,
        headRef: canonicalHeadRef,
        baseRef: canonicalBaseRef || undefined,
        includeContents,
        maxBytes,
        lastKnownBaseSha,
        lastKnownMergeCommitSha,
      });

      if (resp.ok) {
        return resp.diffs;
      } else {
        throw new Error(resp.error || "Failed to load repository diffs");
      }
    },
    staleTime: 10_000,
    enabled: Boolean(canonicalHeadRef) && Boolean(repoKey.trim()),
  });
}
