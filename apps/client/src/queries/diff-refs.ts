import { waitForConnectedSocket } from "@/contexts/socket/socket-boot";
import type { ReplaceDiffEntry } from "@cmux/shared";
import { queryOptions } from "@tanstack/react-query";

export function diffRefsQueryOptions({
  repoFullName,
  ref1,
  ref2,
}: {
  repoFullName: string;
  ref1: string;
  ref2: string;
}) {
  return queryOptions({
    queryKey: ["diff-refs", repoFullName, ref1, ref2],
    queryFn: async () => {
      const socket = await waitForConnectedSocket();
      return await new Promise<ReplaceDiffEntry[]>((resolve, reject) => {
        socket.emit(
          "git-diff-refs",
          { repoFullName, ref1, ref2 },
          (
            resp:
              | { ok: true; diffs: ReplaceDiffEntry[] }
              | { ok: false; error: string }
          ) => {
            if (resp.ok) resolve(resp.diffs);
            else reject(new Error(resp.error || "Failed to load ref diffs"));
          }
        );
      });
    },
    staleTime: 10_000,
  });
}
