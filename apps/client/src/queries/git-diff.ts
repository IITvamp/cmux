import { waitForConnectedSocket } from "@/contexts/socket/socket-boot";
import { normalizeGitRef } from "@/lib/refWithOrigin";
import type { ReplaceDiffEntry } from "@cmux/shared";
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
      const socket = await waitForConnectedSocket();
      return await new Promise<ReplaceDiffEntry[]>((resolve, reject) => {
        socket.emit(
          "git-diff",
          {
            repoFullName,
            repoUrl,
            originPathOverride,
            headRef: canonicalHeadRef,
            baseRef: canonicalBaseRef || undefined,
            includeContents,
            maxBytes,
            lastKnownBaseSha,
            lastKnownMergeCommitSha,
          },
          (
            resp:
              | { ok: true; diffs: ReplaceDiffEntry[] }
              | { ok: false; error: string; diffs?: [] }
          ) => {
            if (resp.ok) {
              resolve(resp.diffs);
            } else {
              reject(
                new Error(resp.error || "Failed to load repository diffs")
              );
            }
          }
        );
      });
    },
    staleTime: 10_000,
    enabled: Boolean(canonicalHeadRef) && Boolean(repoKey.trim()),
  });
}

export interface GitDiffSmartQuery {
  taskRunId: string;
  includeContents?: boolean;
}

export function gitDiffSmartQueryOptions({
  taskRunId,
  includeContents = true,
}: GitDiffSmartQuery) {
  const trimmedRunId = taskRunId.trim();

  return queryOptions({
    queryKey: [
      "git-diff-smart",
      trimmedRunId,
      includeContents ? "with-contents" : "no-contents",
    ],
    queryFn: async () => {
      const socket = await waitForConnectedSocket();
      return await new Promise<ReplaceDiffEntry[]>((resolve, reject) => {
        socket.emit(
          "git-diff-smart",
          {
            taskRunId: trimmedRunId,
            includeContents,
          },
          (
            resp:
              | { ok: true; diffs: ReplaceDiffEntry[] }
              | { ok: false; error: string; diffs: [] }
          ) => {
            if (resp.ok) {
              resolve(resp.diffs);
            } else {
              reject(
                new Error(resp.error || "Failed to load run diffs")
              );
            }
          }
        );
      });
    },
    staleTime: 10_000,
    enabled: Boolean(trimmedRunId),
  });
}
