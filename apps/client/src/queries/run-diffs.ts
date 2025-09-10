import type { CmuxSocket } from "@/contexts/socket/types";
import type { Id } from "@cmux/convex/dataModel";
import type { ReplaceDiffEntry } from "@cmux/shared";
import { queryOptions } from "@tanstack/react-query";

type RunDiffsQueryResult = {
  diffs: ReplaceDiffEntry[];
  totalAdditions: number;
  totalDeletions: number;
  hasChanges: boolean;
};

export function runDiffsQueryOptions({
  socket,
  selectedRunId,
}: {
  socket: CmuxSocket;
  selectedRunId?: Id<"taskRuns">;
}) {
  return queryOptions<RunDiffsQueryResult | undefined>({
    enabled: Boolean(!!selectedRunId && socket && socket.active),
    queryKey: ["run-diffs", selectedRunId, socket?.active],
    queryFn: async () =>
      await new Promise<RunDiffsQueryResult | undefined>((resolve, reject) => {
        if (!selectedRunId || !socket || !socket.active) {
          throw new Error("No socket or selected run id");
        }
        socket.emit("get-run-diffs", { taskRunId: selectedRunId }, (resp) => {
          if (resp.ok) {
            const totalAdditions = resp.diffs.reduce(
              (acc, diff) => acc + diff.additions,
              0
            );
            const totalDeletions = resp.diffs.reduce(
              (acc, diff) => acc + diff.deletions,
              0
            );
            const hasChanges =
              (totalAdditions || 0) + (totalDeletions || 0) > 0;
            resolve({
              diffs: resp.diffs,
              totalAdditions,
              totalDeletions,
              hasChanges,
            });
          } else {
            reject(new Error(resp.error || "Failed to load diffs"));
          }
        });
      }),
    staleTime: 10_000,
  });
}
