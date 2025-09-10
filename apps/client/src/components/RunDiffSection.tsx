import { useSocketSuspense } from "@/contexts/socket/use-socket";
import { runDiffsQueryOptions } from "@/queries/run-diffs";
import type { Id } from "@cmux/convex/dataModel";
import type { GitFileChanged, ReplaceDiffEntry } from "@cmux/shared";
import { useQueryClient, useQuery as useRQ } from "@tanstack/react-query";
import { useEffect, type ComponentProps } from "react";
import { GitDiffViewer } from "./git-diff-viewer";

export interface RunDiffSectionProps {
  taskRunId: Id<"taskRuns">;
  worktreePath?: string | null;
  classNames?: ComponentProps<typeof GitDiffViewer>["classNames"];
  onControlsChange?: ComponentProps<typeof GitDiffViewer>["onControlsChange"];
}

export function RunDiffSection({
  taskRunId,
  worktreePath,
  classNames,
  onControlsChange,
}: RunDiffSectionProps) {
  const { socket } = useSocketSuspense();
  const queryClient = useQueryClient();

  const diffsQuery = useRQ(runDiffsQueryOptions({ taskRunId }));

  // Live update diffs when files change for this worktree
  useEffect(() => {
    if (!socket || !taskRunId || !worktreePath) return;
    const onChanged = (data: GitFileChanged) => {
      if (data.workspacePath !== worktreePath) return;
      socket.emit(
        "get-run-diffs",
        { taskRunId },
        (resp: { ok: boolean; diffs: ReplaceDiffEntry[]; error?: string }) => {
          if (resp.ok && queryClient) {
            queryClient.setQueryData(["run-diffs", taskRunId], resp.diffs);
          }
        }
      );
    };
    socket.on("git-file-changed", onChanged);
    return () => {
      socket.off("git-file-changed", onChanged);
    };
  }, [socket, taskRunId, worktreePath, queryClient]);

  if (diffsQuery.isPending) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-neutral-500 dark:text-neutral-400 text-sm select-none">
          Loading diffs...
        </div>
      </div>
    );
  }

  if (!diffsQuery.isSuccess) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500 dark:text-red-400 text-sm select-none">
          Failed to load diffs.
          <pre>{JSON.stringify(diffsQuery.error)}</pre>
        </div>
      </div>
    );
  }

  if (diffsQuery.data.length === 0) {
    <div className="flex items-center justify-center h-full">
      <div className="text-neutral-500 dark:text-neutral-400 text-sm select-none">
        No changes to display
      </div>
    </div>;
  }

  return (
    <GitDiffViewer
      diffs={diffsQuery.data}
      taskRunId={taskRunId}
      onControlsChange={onControlsChange}
      classNames={classNames}
    />
  );
}
