import { waitForConnectedSocket } from "@/contexts/socket/socket-boot";
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
}

export function gitDiffQueryOptions({
  repoFullName,
  repoUrl,
  originPathOverride,
  headRef,
  baseRef,
  includeContents = true,
  maxBytes,
}: GitDiffQuery) {
  const repoKey = repoFullName ?? repoUrl ?? originPathOverride ?? "";

  return queryOptions({
    queryKey: [
      "git-diff",
      repoKey,
      headRef,
      baseRef ?? "",
      includeContents ? "with-contents" : "no-contents",
      maxBytes ?? "",
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
            headRef,
            baseRef,
            includeContents,
            maxBytes,
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
    enabled: Boolean(headRef?.trim()) && Boolean(repoKey.trim()),
  });
}
