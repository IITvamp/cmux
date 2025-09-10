import type { Id } from "@cmux/convex/dataModel";
import type { ReplaceDiffEntry } from "@cmux/shared";
import { queryOptions } from "@tanstack/react-query";
import type { CmuxSocket } from "@/contexts/socket/types";

export function runDiffsQueryOptions({
  socket,
  selectedRunId,
}: {
  socket: CmuxSocket;
  selectedRunId?: Id<"taskRuns">;
}) {
  return queryOptions<ReplaceDiffEntry[] | undefined>({
    enabled: Boolean(!!selectedRunId && socket && socket.active),
    queryKey: ["run-diffs", selectedRunId, socket?.active],
    queryFn: async () =>
      await new Promise<ReplaceDiffEntry[] | undefined>((resolve, reject) => {
        if (!selectedRunId || !socket || !socket.active) {
          throw new Error("No socket or selected run id");
        }
        socket.emit("get-run-diffs", { taskRunId: selectedRunId }, (resp) => {
          if (resp.ok) resolve(resp.diffs);
          else reject(new Error(resp.error || "Failed to load diffs"));
        });
      }),
    staleTime: 10_000,
  });
}

