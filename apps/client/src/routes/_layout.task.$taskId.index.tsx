import { FloatingPane } from "@/components/floating-pane";
import { GitDiffViewer } from "@/components/git-diff-viewer";
import { TaskDetailHeader } from "@/components/task-detail-header";
import { type MergeMethod } from "@/components/ui/merge-button";
import { useSocket } from "@/contexts/socket/use-socket";
import { api } from "@cmux/convex/api";
import { type Id } from "@cmux/convex/dataModel";
import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/_layout/task/$taskId/")({
  component: TaskDetailPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      runId: search.runId as string | undefined,
    };
  },
  loader: async (opts) => {
    await Promise.all([
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.taskRuns.getByTask, {
          taskId: opts.params.taskId as Id<"tasks">,
        })
      ),
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.tasks.getById, {
          id: opts.params.taskId as Id<"tasks">,
        })
      ),
    ]);
  },
});

function TaskDetailPage() {
  const { taskId } = Route.useParams();
  const { runId } = Route.useSearch();

  const [isCreatingPr, setIsCreatingPr] = useState(false);
  const [isCheckingDiffs, setIsCheckingDiffs] = useState(false);
  const [diffControls, setDiffControls] = useState<{
    expandAll: () => void;
    collapseAll: () => void;
    totalAdditions: number;
    totalDeletions: number;
  } | null>(null);
  const { socket } = useSocket();

  const task = useQuery(api.tasks.getById, {
    id: taskId as Id<"tasks">,
  });
  const taskRuns = useQuery(api.taskRuns.getByTask, {
    taskId: taskId as Id<"tasks">,
  });

  // Find the crowned run (if any)
  const crownedRun = taskRuns?.find((run) => run.isCrowned);

  // Select the run to display (either from query param, crowned, or first available)
  const selectedRun = useMemo(() => {
    if (runId) {
      return taskRuns?.find((run) => run._id === runId);
    }
    // Default to crowned run if available, otherwise first completed run
    return (
      crownedRun ||
      taskRuns?.find((run) => run.status === "completed") ||
      taskRuns?.[0]
    );
  }, [runId, taskRuns, crownedRun]);

  // Fetch diffs for the selected run
  const diffs = useQuery(
    api.gitDiffs.getByTaskRun,
    selectedRun ? { taskRunId: selectedRun._id } : "skip"
  );

  // Check for new changes on mount and periodically
  useEffect(() => {
    if (!selectedRun) return;

    const checkForChanges = async () => {
      setIsCheckingDiffs(true);

      try {
        // Use Socket.IO to request diff refresh from the server
        if (!socket) {
          console.warn("Socket not available");
          setIsCheckingDiffs(false);
          return;
        }

        socket.emit(
          "refresh-diffs",
          { taskRunId: selectedRun._id },
          (response: { success: boolean; message?: string }) => {
            if (response.success) {
              console.log("Diff refresh:", response.message);
              // The diffs will be updated reactively via the useQuery hook
            } else {
              console.log("Could not refresh diffs:", response.message);
            }
            setIsCheckingDiffs(false);
          }
        );
      } catch (error) {
        console.error("Error refreshing diffs:", error);
        setIsCheckingDiffs(false);
      }
    };

    // Check on mount
    checkForChanges();

    // Check periodically (every 30 seconds)
    const interval = setInterval(checkForChanges, 30000);

    return () => clearInterval(interval);
  }, [selectedRun?._id]);

  // Stabilize diffs per-run to avoid cross-run flashes
  const [stableDiffsByRun, setStableDiffsByRun] = useState<
    Record<string, typeof diffs>
  >({});
  useEffect(() => {
    if (!diffs || isCheckingDiffs || !selectedRun?._id) return;
    const runKey = selectedRun._id as string;
    setStableDiffsByRun((prev) => {
      const prevForRun = prev[runKey];
      if (!prevForRun) return { ...prev, [runKey]: diffs };
      const prevByPath = new Map(prevForRun.map((d) => [d.filePath, d]));
      const next: typeof diffs = diffs.map((d) => {
        const p = prevByPath.get(d.filePath);
        if (!p) return d;
        const same =
          p.status === d.status &&
          p.additions === d.additions &&
          p.deletions === d.deletions &&
          p.isBinary === d.isBinary &&
          (p.patch || "") === (d.patch || "") &&
          (p.oldContent || "") === (d.oldContent || "") &&
          (p.newContent || "") === (d.newContent || "") &&
          (p.contentOmitted || false) === (d.contentOmitted || false);
        return same ? p : d;
      });
      return { ...prev, [runKey]: next };
    });
  }, [diffs, isCheckingDiffs, selectedRun?._id]);

  // When a refresh cycle ends, apply whatever the latest diffs are for this run
  useEffect(() => {
    if (!isCheckingDiffs && diffs && selectedRun?._id) {
      setStableDiffsByRun((prev) => ({
        ...prev,
        [selectedRun._id as string]: diffs,
      }));
    }
  }, [isCheckingDiffs, diffs, selectedRun?._id]);

  const handleMerge = (method: MergeMethod) => {
    // TODO: Implement merge logic
    console.log("Merging with method:", method);
  };
  return (
    <FloatingPane>
      <div className="flex h-full min-h-0 flex-col relative">
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="h-3"></div>
          <TaskDetailHeader
            task={task ?? null}
            taskRuns={taskRuns ?? null}
            selectedRun={selectedRun ?? null}
            isCheckingDiffs={isCheckingDiffs}
            isCreatingPr={isCreatingPr}
            setIsCreatingPr={setIsCreatingPr}
            onMerge={handleMerge}
            totalAdditions={diffControls?.totalAdditions}
            totalDeletions={diffControls?.totalDeletions}
            onExpandAll={diffControls?.expandAll}
            onCollapseAll={diffControls?.collapseAll}
          />
          <div className="h-1.5"></div>
          {task?.text && (
            <div className="mb-2 px-4">
              <div className="text-xs text-neutral-300">
                <span className="text-neutral-400">Prompt:</span>{" "}
                <span className="font-medium">{task.text}</span>
              </div>
            </div>
          )}
          <div className="bg-white dark:bg-neutral-950">
            <GitDiffViewer
              diffs={
                (selectedRun?._id
                  ? stableDiffsByRun[selectedRun._id as string]
                  : undefined) ||
                diffs ||
                []
              }
              isLoading={!diffs && !!selectedRun}
              taskRunId={selectedRun?._id}
              key={selectedRun?._id}
              onControlsChange={(c) => setDiffControls(c)}
            />
          </div>
        </div>
      </div>
    </FloatingPane>
  );
}
