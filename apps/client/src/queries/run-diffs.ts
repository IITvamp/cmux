import { waitForConnectedSocket } from "@/contexts/socket/socket-boot";
import type { Id } from "@cmux/convex/dataModel";
import type { ReplaceDiffEntry } from "@cmux/shared";
import { queryOptions } from "@tanstack/react-query";

export function runDiffsQueryOptions({
  taskRunId,
}: {
  taskRunId: Id<"taskRuns">;
}) {
  return queryOptions({
    queryKey: ["run-diffs", taskRunId],
    queryFn: async () => {
      const socket = await waitForConnectedSocket();
      return await new Promise<ReplaceDiffEntry[]>((resolve, reject) => {
        socket.emit("get-run-diffs", { taskRunId }, (resp) => {
          if (resp.ok) {
            resolve(resp.diffs);
          } else {
            reject(new Error(resp.error || "Failed to load diffs"));
          }
        });
      });
    },
    staleTime: 10_000,
  });
}
