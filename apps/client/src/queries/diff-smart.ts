import { waitForConnectedSocket } from "@/contexts/socket/socket-boot";
import type { ReplaceDiffEntry } from "@cmux/shared";
import { queryOptions } from "@tanstack/react-query";

export function diffSmartQueryOptions({
  repoFullName,
  baseRef,
  headRef,
  b0Ref,
}: {
  repoFullName: string;
  baseRef: string;
  headRef: string;
  b0Ref?: string;
}) {
  return queryOptions({
    queryKey: ["diff-smart", repoFullName, baseRef, headRef, b0Ref || ""],
    queryFn: async () => {
      const socket = await waitForConnectedSocket();
      return await new Promise<ReplaceDiffEntry[]>((resolve, reject) => {
        socket.emit(
          "git-diff-smart",
          { repoFullName, baseRef, headRef, b0Ref },
          (
            resp:
              | { ok: true; diffs: ReplaceDiffEntry[]; strategy?: "latest" | "landed" }
              | { ok: false; error: string }
          ) => {
            if (resp.ok) resolve(resp.diffs);
            else reject(new Error(resp.error || "Failed to load smart diffs"));
          }
        );
      });
    },
    staleTime: 10_000,
  });
}

