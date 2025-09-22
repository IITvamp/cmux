import { FloatingPane } from "@/components/floating-pane";
import { type GitDiffViewerProps } from "@/components/git-diff-viewer";
import { RunDiffSection } from "@/components/RunDiffSection";
import { TaskDetailHeader } from "@/components/task-detail-header";
import { useTheme } from "@/components/theme/use-theme";
import { useExpandTasks } from "@/contexts/expand-tasks/ExpandTasksContext";
import { useSocket } from "@/contexts/socket/use-socket";
import { refWithOrigin } from "@/lib/refWithOrigin";
import { diffSmartQueryOptions } from "@/queries/diff-smart";
// Refs mode: no run-diffs prefetch
import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Suspense, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import z from "zod";

const paramsSchema = z.object({
  taskId: typedZid("tasks"),
  runId: typedZid("taskRuns"),
});

const gitDiffViewerClassNames: GitDiffViewerProps["classNames"] = {
  fileDiffRow: {
    button: "top-[96px] md:top-[56px]",
  },
};

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
    const { runId } = opts.params;
    const [taskRuns, task] = await Promise.all([
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
    const selectedTaskRun = taskRuns.find((run) => run._id === runId);
    if (
      task?.baseBranch &&
      task.projectFullName &&
      selectedTaskRun?.newBranch
    ) {
      void opts.context.queryClient.ensureQueryData(
        diffSmartQueryOptions({
          baseRef: task.baseBranch,
          headRef: selectedTaskRun?.newBranch,
          repoFullName: task.projectFullName,
        })
      );
    }
  },
});

function RunDiffPage() {
  const { taskId, teamSlugOrId, runId } = Route.useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { theme } = useTheme();
  const { addTaskToExpand } = useExpandTasks();
  const [isCreatingPr, setIsCreatingPr] = useState(false);
  const [diffControls, setDiffControls] = useState<{
    expandAll: () => void;
    collapseAll: () => void;
    totalAdditions: number;
    totalDeletions: number;
  } | null>(null);
  const task = useQuery(api.tasks.getById, {
    teamSlugOrId,
    id: taskId,
  });
  const taskRuns = useQuery(api.taskRuns.getByTask, {
    teamSlugOrId,
    taskId,
  });
  const selectedRun = useMemo(() => {
    return taskRuns?.find((run) => run._id === runId);
  }, [runId, taskRuns]);

  const createTask = useMutation(api.tasks.create);
  const [followUp, setFollowUp] = useState<string>("");
  const [starting, setStarting] = useState<boolean>(false);

  const handleStartFollowUp = useCallback(async () => {
    if (!task || !task.text || !followUp.trim()) {
      toast.error("Enter follow-up text to start a new task");
      return;
    }
    if (!socket) {
      toast.error("Socket not connected");
      return;
    }

    const original = task.text.trim();
    const appended = followUp.trim();
    const composedText = `${original}\n\nFollow-up:\n${appended}`;

    const projectFullName = task.projectFullName || "";
    const baseBranch = task.baseBranch || "main";
    const environmentId = task.environmentId;

    try {
      setStarting(true);
      const newTaskId = await createTask({
        teamSlugOrId,
        text: composedText,
        projectFullName: projectFullName || undefined,
        baseBranch: environmentId ? undefined : baseBranch,
        environmentId: environmentId || undefined,
      });

      addTaskToExpand(newTaskId);

      const isCloudPref = (() => {
        try {
          const stored = localStorage.getItem("isCloudMode");
          return stored ? JSON.parse(stored) === true : false;
        } catch {
          return false;
        }
      })();
      const selectedAgents: string[] | undefined = (() => {
        try {
          const stored = localStorage.getItem("selectedAgents");
          const parsed = stored ? (JSON.parse(stored) as string[]) : null;
          return parsed && parsed.length > 0
            ? parsed
            : ["claude/opus-4.1", "codex/gpt-5"];
        } catch {
          return ["claude/opus-4.1", "codex/gpt-5"];
        }
      })();

      const repoUrl = projectFullName
        ? `https://github.com/${projectFullName}.git`
        : undefined;

      socket.emit(
        "start-task",
        {
          ...(environmentId
            ? {}
            : { repoUrl, branch: baseBranch, projectFullName }),
          taskDescription: composedText,
          projectFullName: projectFullName || "",
          taskId: newTaskId,
          selectedAgents,
          isCloudMode: environmentId ? true : isCloudPref,
          theme,
          ...(environmentId ? { environmentId } : {}),
        },
        (response: { taskId: typeof newTaskId; error?: string }) => {
          if (response.error) {
            toast.error(response.error);
          } else {
            toast.success("Started follow-up task");
            void navigate({
              to: "/$teamSlugOrId/task/$taskId",
              params: { teamSlugOrId, taskId: newTaskId },
            });
          }
        }
      );

      setFollowUp("");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    } finally {
      setStarting(false);
    }
  }, [addTaskToExpand, createTask, followUp, navigate, socket, task, teamSlugOrId, theme]);

  // 404 if selected run is missing
  if (!selectedRun) {
    return (
      <div className="p-6 text-sm text-neutral-600 dark:text-neutral-300">
        404 – Run not found
      </div>
    );
  }

  const taskRunId = selectedRun._id;

  // Compute refs for diff: base branch vs run branch
  const repoFullName = task?.projectFullName || "";
  const ref1 = refWithOrigin(task?.baseBranch || "main");
  const ref2 = refWithOrigin(selectedRun.newBranch || "");

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
            taskRunId={taskRunId}
            onExpandAll={diffControls?.expandAll}
            onCollapseAll={diffControls?.collapseAll}
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
              {repoFullName && ref1 && ref2 ? (
                <RunDiffSection
                  repoFullName={repoFullName}
                  ref1={ref1}
                  ref2={ref2}
                  onControlsChange={setDiffControls}
                  classNames={gitDiffViewerClassNames}
                />
              ) : (
                <div className="p-6 text-sm text-neutral-600 dark:text-neutral-300">
                  Missing repo or branches to show diff.
                </div>
              )}
            </Suspense>
            {/* Follow-up composer under diff viewer */}
            <div className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
              <div className="px-3.5 py-3 max-w-[1200px] w-full mx-auto">
                <label className="text-xs text-neutral-600 dark:text-neutral-300 select-none">
                  Follow-up context
                </label>
                <div className="mt-1 flex gap-2">
                  <textarea
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    placeholder="Describe the next change. This will be appended to the original prompt."
                    className="flex-1 min-h-16 max-h-40 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600"
                  />
                  <button
                    onClick={handleStartFollowUp}
                    disabled={starting || !followUp.trim()}
                    className="self-start shrink-0 inline-flex items-center gap-1 rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-3 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
                    title="Start a new task from this follow-up"
                  >
                    {starting ? "Starting…" : "Start follow-up"}
                  </button>
                </div>
                {task?.text ? (
                  <div className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400 select-none">
                    The original prompt will be included automatically.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </FloatingPane>
  );
}
