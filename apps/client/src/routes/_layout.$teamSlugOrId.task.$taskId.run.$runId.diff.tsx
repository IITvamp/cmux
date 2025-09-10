import { FloatingPane } from "@/components/floating-pane";
import { GitDiffViewer } from "@/components/git-diff-viewer";
import { RunDiffSection } from "@/components/RunDiffSection";
import { TaskDetailHeader } from "@/components/task-detail-header";
// Socket usage is delegated to child components to enable localized Suspense
import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import { convexQuery } from "@convex-dev/react-query";
// no tanstack query here; child handles diffs fetching
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Suspense, useMemo, useState, type ComponentProps } from "react";
import z from "zod";

const paramsSchema = z.object({
  taskId: typedZid("tasks"),
  runId: typedZid("taskRuns"),
});

const gitDiffViewerClassNames: ComponentProps<
  typeof GitDiffViewer
>["classNames"] = {
  fileDiffRow: {
    button: "top-[96px] md:top-[56px]",
  },
};

// diffs query logic moved into RunDiffSection to avoid socket use in this page

export const Route = createFileRoute(
  "/_layout/$teamSlugOrId/task/$taskId/run/$runId/diff"
)({
  component: RunDiffPage,
  params: {
    parse: paramsSchema.parse,
    stringify: (params) => {
      return {
        taskId: params.taskId,
        runId: params.runId,
      };
    },
  },
  loader: async (opts) => {
    await Promise.all([
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.taskRuns.getByTask, {
          teamSlugOrId: opts.params.teamSlugOrId,
          taskId: opts.params.taskId,
        })
      ),
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.tasks.getById, {
          teamSlugOrId: opts.params.teamSlugOrId,
          id: opts.params.taskId,
        })
      ),
    ]);
  },
});

function RunDiffPage() {
  const { taskId, teamSlugOrId, runId } = Route.useParams();

  const [isCreatingPr, setIsCreatingPr] = useState(false);
  const [diffControls, setDiffControls] = useState<{
    expandAll: () => void;
    collapseAll: () => void;
    totalAdditions: number;
    totalDeletions: number;
  } | null>(null);
  // Router available if needed via useRouter(); not used here directly

  const task = useQuery(api.tasks.getById, {
    teamSlugOrId,
    id: taskId,
  });
  const taskRuns = useQuery(api.taskRuns.getByTask, {
    teamSlugOrId,
    taskId,
  });

  // Get the specific run from the URL parameter
  const selectedRun = useMemo(() => {
    return taskRuns?.find((run) => run._id === runId);
  }, [runId, taskRuns]);

  // Merge handlers moved into TaskDetailHeader (Suspense child)
  const [isDiffsLoading, setIsDiffsLoading] = useState(false);
  const [hasAnyDiffs, setHasAnyDiffs] = useState(false);

  return (
    <FloatingPane>
      <div className="flex h-full min-h-0 flex-col relative isolate">
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
          <TaskDetailHeader
            task={task}
            taskRuns={taskRuns ?? null}
            selectedRun={selectedRun ?? null}
            isCreatingPr={isCreatingPr}
            setIsCreatingPr={setIsCreatingPr}
            totalAdditions={diffControls?.totalAdditions}
            totalDeletions={diffControls?.totalDeletions}
            hasAnyDiffs={hasAnyDiffs}
            onExpandAll={diffControls?.expandAll}
            onCollapseAll={diffControls?.collapseAll}
            isLoading={isDiffsLoading}
            teamSlugOrId={teamSlugOrId}
          />
          {task?.text && (
            <div className="mb-2 px-3.5">
              <div className="text-xs text-neutral-600 dark:text-neutral-300">
                <span className="text-neutral-500 dark:text-neutral-400 select-none">
                  Prompt:{" "}
                </span>
                <span className="font-medium">{task.text}</span>
              </div>
            </div>
          )}
          <div className="bg-white dark:bg-neutral-950 grow flex flex-col">
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-full">
                  <div className="text-neutral-500 dark:text-neutral-400 text-sm select-none">
                    Loading diffs...
                  </div>
                </div>
              }
            >
              <RunDiffSection
                selectedRunId={selectedRun?._id || runId}
                worktreePath={selectedRun?.worktreePath || null}
                onControlsChange={setDiffControls}
                onLoadingChange={setIsDiffsLoading}
                onHasAnyDiffsChange={setHasAnyDiffs}
                classNames={gitDiffViewerClassNames}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </FloatingPane>
  );
}
