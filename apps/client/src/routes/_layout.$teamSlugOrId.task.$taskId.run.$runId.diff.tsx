import { FloatingPane } from "@/components/floating-pane";
import { type GitDiffViewerProps } from "@/components/git-diff-viewer";
import { RunDiffSection } from "@/components/RunDiffSection";
import { TaskDetailHeader } from "@/components/task-detail-header";
import { useExpandTasks } from "@/contexts/expand-tasks/ExpandTasksContext";
import { useSocket } from "@/contexts/socket/use-socket";
import { useTheme } from "@/components/theme/use-theme";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@heroui/react";
import { refWithOrigin } from "@/lib/refWithOrigin";
import { diffSmartQueryOptions } from "@/queries/diff-smart";
// Refs mode: no run-diffs prefetch
import { api } from "@cmux/convex/api";
import type { Doc } from "@cmux/convex/dataModel";
import { AGENT_CONFIGS } from "@cmux/shared/agentConfig";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
  Suspense,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import TextareaAutosize from "react-textarea-autosize";
import { toast } from "sonner";
import z from "zod";
import { Command, FileText, Pencil } from "lucide-react";

const paramsSchema = z.object({
  taskId: typedZid("tasks"),
  runId: typedZid("taskRuns"),
});

const gitDiffViewerClassNames: GitDiffViewerProps["classNames"] = {
  fileDiffRow: {
    button: "top-[96px] md:top-[56px]",
  },
};

type TaskRunWithChildren = Doc<"taskRuns"> & {
  children: TaskRunWithChildren[];
};

const AVAILABLE_AGENT_NAMES = new Set(
  AGENT_CONFIGS.map((agent) => agent.name)
);

function collectAgentNamesFromRuns(
  runs: TaskRunWithChildren[] | undefined
): string[] {
  if (!runs) return [];

  const seen = new Set<string>();
  const ordered: string[] = [];

  const traverse = (items: TaskRunWithChildren[]) => {
    for (const run of items) {
      const trimmed = run.agentName?.trim();
      if (trimmed && AVAILABLE_AGENT_NAMES.has(trimmed) && !seen.has(trimmed)) {
        seen.add(trimmed);
        ordered.push(trimmed);
      }
      if (run.children && run.children.length > 0) {
        traverse(run.children);
      }
    }
  };

  traverse(runs);
  return ordered;
}

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
  const { socket } = useSocket();
  const { theme } = useTheme();
  const { addTaskToExpand } = useExpandTasks();
  const createTask = useMutation(api.tasks.create);
  const [isCreatingPr, setIsCreatingPr] = useState(false);
  const [diffControls, setDiffControls] = useState<{
    expandAll: () => void;
    collapseAll: () => void;
    totalAdditions: number;
    totalDeletions: number;
  } | null>(null);
  const [followUpText, setFollowUpText] = useState("");
  const [overrideInitialPrompt, setOverrideInitialPrompt] = useState(false);
  const [overridePromptText, setOverridePromptText] = useState("");
  const [isRestartingTask, setIsRestartingTask] = useState(false);
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

  const restartAgents = useMemo(() => {
    const previousAgents = collectAgentNamesFromRuns(taskRuns);
    if (previousAgents.length > 0) {
      return previousAgents;
    }
    const fallback = selectedRun?.agentName?.trim();
    if (fallback && AVAILABLE_AGENT_NAMES.has(fallback)) {
      return [fallback];
    }
    return [];
  }, [selectedRun?.agentName, taskRuns]);

  const taskRunId = selectedRun?._id ?? runId;
  const originalTaskPrompt = task?.text ?? "";

  useEffect(() => {
    if (!overrideInitialPrompt) {
      return;
    }

    setOverridePromptText((current) => {
      const basePrompt = originalTaskPrompt;
      const trimmedCurrent = current.trim();

      if (trimmedCurrent.length > 0 && trimmedCurrent !== basePrompt.trim()) {
        return current;
      }

      const followUp = followUpText.trim();

      if (basePrompt && followUp) {
        return `${basePrompt}\n\n${followUp}`;
      }

      if (basePrompt) {
        return basePrompt;
      }

      return followUp;
    });
  }, [followUpText, originalTaskPrompt, overrideInitialPrompt]);

  const handleRestartTask = useCallback(async () => {
    if (!task) {
      toast.error("Task data is still loading. Try again in a moment.");
      return;
    }
    if (!socket) {
      toast.error("Socket not connected. Refresh or try again later.");
      return;
    }

    const promptInput = overrideInitialPrompt
      ? overridePromptText.trim()
      : followUpText.trim();

    if (!promptInput) {
      toast.error("Add follow-up context before restarting.");
      return;
    }

    if (restartAgents.length === 0) {
      toast.error(
        "No previous agents found for this task. Start a new run from the dashboard."
      );
      return;
    }

    const combinedPrompt = overrideInitialPrompt
      ? promptInput
      : originalTaskPrompt
        ? `${originalTaskPrompt}\n\n${promptInput}`
        : promptInput;

    const projectFullNameForSocket =
      task.projectFullName ??
      (task.environmentId ? `env:${task.environmentId}` : undefined);

    if (!projectFullNameForSocket) {
      toast.error("Missing repository or environment for this task.");
      return;
    }

    setIsRestartingTask(true);

    try {
      const imagesPayload =
        task.images && task.images.length > 0
          ? task.images.map((image) => ({
              storageId: image.storageId,
              fileName: image.fileName,
              altText: image.altText,
            }))
          : undefined;

      const newTaskId = await createTask({
        teamSlugOrId,
        text: combinedPrompt,
        projectFullName: task.projectFullName ?? undefined,
        baseBranch: task.baseBranch ?? undefined,
        images: imagesPayload,
        environmentId: task.environmentId ?? undefined,
      });

      addTaskToExpand(newTaskId);

      const isEnvTask = projectFullNameForSocket.startsWith("env:");
      const repoUrl = !isEnvTask
        ? `https://github.com/${projectFullNameForSocket}.git`
        : undefined;

      await new Promise<void>((resolve) => {
        socket.emit(
          "start-task",
          {
            ...(repoUrl ? { repoUrl } : {}),
            ...(task.baseBranch ? { branch: task.baseBranch } : {}),
            taskDescription: combinedPrompt,
            projectFullName: projectFullNameForSocket,
            taskId: newTaskId,
            selectedAgents: [...restartAgents],
            isCloudMode: isEnvTask || Boolean(task.environmentId),
            ...(task.environmentId ? { environmentId: task.environmentId } : {}),
            theme,
          },
          (response) => {
            if ("error" in response) {
              toast.error(`Task restart error: ${response.error}`);
            } else {
              setFollowUpText("");
              if (overrideInitialPrompt) {
                setOverridePromptText(originalTaskPrompt);
              }
              toast.success("Started follow-up task");
            }
          resolve();
        }
      );
      });
    } catch (error) {
      console.error("Failed to restart task", error);
      toast.error("Failed to start follow-up task");
    } finally {
      setIsRestartingTask(false);
    }
  }, [
    addTaskToExpand,
    createTask,
    followUpText,
    originalTaskPrompt,
    overrideInitialPrompt,
    overridePromptText,
    socket,
    task,
    teamSlugOrId,
    theme,
    restartAgents,
  ]);

  const handleFormSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void handleRestartTask();
    },
    [handleRestartTask]
  );

  const currentPromptInput = overrideInitialPrompt
    ? overridePromptText
    : followUpText;
  const trimmedPromptInput = currentPromptInput.trim();
  const isRestartDisabled =
    isRestartingTask || !trimmedPromptInput || !socket || !task;
  const isMac =
    typeof navigator !== "undefined" &&
    navigator.userAgent.toUpperCase().includes("MAC");
  const restartDisabledReason = useMemo(() => {
    if (isRestartingTask) {
      return "Starting follow-up...";
    }
    if (!task) {
      return "Task data loading...";
    }
    if (!socket) {
      return "Socket not connected";
    }
    if (!trimmedPromptInput) {
      return "Add follow-up context";
    }
    return undefined;
  }, [isRestartingTask, socket, task, trimmedPromptInput]);

  const helperMessage = overrideInitialPrompt
    ? "Override and send a full prompt."
    : task?.text
      ? "Original prompt is included automatically."
      : "This follow-up becomes the new task prompt.";

  const handlePromptKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (!isRestartDisabled) {
          void handleRestartTask();
        }
      }
    },
    [handleRestartTask, isRestartDisabled]
  );

  const handlePromptChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const { value } = event.target;
      if (overrideInitialPrompt) {
        setOverridePromptText(value);
        return;
      }
      setFollowUpText(value);
    },
    [overrideInitialPrompt]
  );

  // 404 if selected run is missing
  if (!selectedRun) {
    return (
      <div className="p-6 text-sm text-neutral-600 dark:text-neutral-300">
        404 – Run not found
      </div>
    );
  }

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
          <div className="bg-white dark:bg-neutral-900 grow flex flex-col">
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
            <div className="sticky bottom-0 z-10 border-t border-transparent px-4 pb-4 pt-3">
              <form
                onSubmit={handleFormSubmit}
                className="mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-neutral-500/15 bg-white dark:border-neutral-500/15 dark:bg-neutral-950"
              >
                <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 sm:py-4">
                  <TextareaAutosize
                    value={currentPromptInput}
                    onChange={handlePromptChange}
                    onKeyDown={handlePromptKeyDown}
                    minRows={1}
                    maxRows={2}
                    placeholder={
                      overrideInitialPrompt
                        ? "Edit or replace the entire task prompt..."
                        : "Add updated instructions or context..."
                    }
                    className="w-full max-h-24 resize-none overflow-y-auto border-none bg-transparent p-0 text-[15px] leading-relaxed text-neutral-900 outline-none placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-1 flex-col gap-2 text-xs leading-tight text-neutral-500 dark:text-neutral-400 sm:flex-row sm:items-center sm:gap-3">
                      <label className="flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-200">
                        <Switch
                          isSelected={overrideInitialPrompt}
                          onValueChange={setOverrideInitialPrompt}
                          size="sm"
                          aria-label="Override original prompt"
                          thumbIcon={({ isSelected, className }) => {
                            const iconClassName = className
                              ? `${className} size-3`
                              : "size-3";
                            return isSelected ? (
                              <FileText className={iconClassName} />
                            ) : (
                              <Pencil className={iconClassName} />
                            );
                          }}
                          classNames={{
                            wrapper:
                              "group-data-[selected=true]:bg-neutral-900 group-data-[selected=true]:border-neutral-900 group-data-[selected=false]:bg-neutral-200 group-data-[selected=false]:border-neutral-300 dark:group-data-[selected=true]:bg-neutral-100 dark:group-data-[selected=true]:border-neutral-100 dark:group-data-[selected=false]:bg-neutral-700/70 dark:group-data-[selected=false]:border-neutral-600 group-data-[focus-visible=true]:ring-2 group-data-[focus-visible=true]:ring-neutral-400/70 group-data-[focus-visible=true]:ring-offset-2 group-data-[focus-visible=true]:ring-offset-white dark:group-data-[focus-visible=true]:ring-offset-neutral-900",
                          }}
                        />
                        <span>Override original prompt</span>
                      </label>
                      <span>{helperMessage}</span>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0} className="inline-flex">
                          <Button
                            type="submit"
                            size="sm"
                            variant="default"
                            className="!h-7"
                            disabled={isRestartDisabled}
                          >
                            {isRestartingTask ? "Starting..." : "Restart task"}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent
                        side="bottom"
                        className="flex items-center gap-1 border-black bg-black text-white [&>*:last-child]:bg-black [&>*:last-child]:fill-black"
                      >
                        {restartDisabledReason ? (
                          <span className="text-xs">{restartDisabledReason}</span>
                        ) : (
                          <>
                            {isMac ? (
                              <Command className="h-3 w-3" />
                            ) : (
                              <span className="text-xs">Ctrl</span>
                            )}
                            <span>+ Enter</span>
                          </>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </FloatingPane>
  );
}
