import { useSocketSuspense } from "@/contexts/socket/use-socket";
import { runDiffsQueryOptions } from "@/queries/run-diffs";
import type { Id } from "@cmux/convex/dataModel";
import type { ReplaceDiffEntry } from "@cmux/shared";
import { useQueryClient, useQuery as useRQ } from "@tanstack/react-query";
import { useEffect, type ComponentProps } from "react";
import { GitDiffViewer } from "./git-diff-viewer";

export interface RunDiffSectionProps {
  selectedRunId?: Id<"taskRuns">;
  worktreePath?: string | null;
  classNames?: ComponentProps<typeof GitDiffViewer>["classNames"];
  onControlsChange?: ComponentProps<typeof GitDiffViewer>["onControlsChange"];
}

export function RunDiffSection({
  selectedRunId,
  worktreePath,
  classNames,
  onControlsChange,
}: RunDiffSectionProps) {
  const { socket } = useSocketSuspense();
  const queryClient = useQueryClient();
  const diffsQuery = useRQ(runDiffsQueryOptions({ socket, selectedRunId }));

  // Live update diffs when files change for this worktree
  useEffect(() => {
    if (!socket || !selectedRunId || !worktreePath) return;
    const onChanged = (data: { workspacePath: string; filePath: string }) => {
      if (data.workspacePath !== worktreePath) return;
      socket.emit(
        "get-run-diffs",
        { taskRunId: selectedRunId },
        (resp: { ok: boolean; diffs: ReplaceDiffEntry[]; error?: string }) => {
          if (resp.ok && queryClient) {
            queryClient.setQueryData(["run-diffs", selectedRunId], resp.diffs);
          }
        }
      );
    };
    socket.on("git-file-changed", onChanged);
    return () => {
      socket.off("git-file-changed", onChanged);
    };
  }, [socket, selectedRunId, worktreePath, queryClient]);

  // Initial fetch on run change
  useEffect(() => {
    if (!selectedRunId) return;
    void diffsQuery.refetch();
  }, [selectedRunId, diffsQuery.refetch, diffsQuery]);

  return (
    <GitDiffViewer
      diffs={diffsQuery.data?.diffs || []}
      isLoading={!diffsQuery.data && !!selectedRunId}
      taskRunId={selectedRunId}
      onControlsChange={onControlsChange}
      classNames={classNames}
    />
  );
}
