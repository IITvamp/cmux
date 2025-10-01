import { FloatingPane } from "@/components/floating-pane";
import { type GitDiffViewerProps } from "@/components/git-diff-viewer";
import { RunDiffSection } from "@/components/RunDiffSection";
import { TaskDetailHeader } from "@/components/task-detail-header";
import { useTheme } from "@/components/theme/use-theme";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useExpandTasks } from "@/contexts/expand-tasks/ExpandTasksContext";
import { useSocket } from "@/contexts/socket/use-socket";
import { normalizeGitRef } from "@/lib/refWithOrigin";
import { cn } from "@/lib/utils";
import { gitDiffQueryOptions } from "@/queries/git-diff";
import { api } from "@cmux/convex/api";
import type { Doc } from "@cmux/convex/dataModel";
import { AGENT_CONFIGS } from "@cmux/shared/agentConfig";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import { convexQuery } from "@convex-dev/react-query";
import { Switch } from "@heroui/react";
import { useQuery as useRQ } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Command } from "lucide-react";
import {
  Suspense,
  useCallback,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import TextareaAutosize from "react-textarea-autosize";
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

type DiffControls = Parameters<
  NonNullable<GitDiffViewerProps["onControlsChange"]>
>[0];

type RunEnvironmentSummary = Pick<
  Doc<"environments">,
  "_id" | "name" | "selectedRepos"
>;

type TaskRunWithChildren = Doc<"taskRuns"> & {
  children: TaskRunWithChildren[];
  environment: RunEnvironmentSummary | null;
};

const AVAILABLE_AGENT_NAMES = new Set(AGENT_CONFIGS.map((agent) => agent.name));

function collectAgentNamesFromRuns(
  runs: TaskRunWithChildren[] | undefined,
): string[] {
  if (!runs) return [];

  const ordered: string[] = [];

  const traverse = (items: TaskRunWithChildren[]) => {
    for (const run of items) {
      const trimmed = run.agentName?.trim();
      if (trimmed && AVAILABLE_AGENT_NAMES.has(trimmed)) {
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
  "/_layout/$teamSlugOrId/task/$taskId/run/$runId/diff",
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
  loader: (opts) => {
    const { runId } = opts.params;

    void opts.context.queryClient
      .ensureQueryData(
        convexQuery(api.taskRuns.getRunDiffContext, {
          teamSlugOrId: opts.params.teamSlugOrId,
          taskId: opts.params.taskId,
          runId,
        }),
      )
      .then(async (context) => {
        if (!context) {
          return;
        }

        const { task, taskRuns, branchMetadataByRepo } = context;

        if (task) {
          opts.context.queryClient.setQueryData(
            convexQuery(api.tasks.getById, {
              teamSlugOrId: opts.params.teamSlugOrId,
              id: opts.params.taskId,
            }).queryKey,
            task,
          );
        }

        if (taskRuns) {
          opts.context.queryClient.setQueryData(
            convexQuery(api.taskRuns.getByTask, {
              teamSlugOrId: opts.params.teamSlugOrId,
              taskId: opts.params.taskId,
            }).queryKey,
            taskRuns,
          );
        }

        const selectedTaskRun = taskRuns.find((run) => run._id === runId);
        if (!task || !selectedTaskRun?.newBranch) {
          return;
        }

        const trimmedProjectFullName = task.projectFullName?.trim();
        const targetRepos = new Set<string>();
        for (const repo of selectedTaskRun.environment?.selectedRepos ?? []) {
          const trimmed = repo?.trim();
          if (trimmed) {
            targetRepos.add(trimmed);
          }
        }
        if (trimmedProjectFullName) {
          targetRepos.add(trimmedProjectFullName);
        }

        if (targetRepos.size === 0) {
          return;
        }

        const baseRefForDiff = normalizeGitRef(task.baseBranch || "main");
        const headRefForDiff = normalizeGitRef(selectedTaskRun.newBranch);
        if (!headRefForDiff || !baseRefForDiff) {
          return;
        }

        const metadataForPrimaryRepo = trimmedProjectFullName
          ? branchMetadataByRepo?.[trimmedProjectFullName]
          : undefined;
        const baseBranchMeta = metadataForPrimaryRepo?.find(
          (branch) => branch.name === task.baseBranch,
        );

        const prefetches = Array.from(targetRepos).map(async (repoFullName) => {
          const metadata =
            trimmedProjectFullName && repoFullName === trimmedProjectFullName
              ? baseBranchMeta
              : undefined;

          return opts.context.queryClient
            .ensureQueryData(
              gitDiffQueryOptions({
                baseRef: baseRefForDiff,
                headRef: headRefForDiff,
                repoFullName,
                lastKnownBaseSha: metadata?.lastKnownBaseSha,
                lastKnownMergeCommitSha: metadata?.lastKnownMergeCommitSha,
              }),
            )
            .catch(() => undefined);
        });

        await Promise.all(prefetches);
      })
      .catch(() => undefined);

    return undefined;
  },
});

function RunDiffPage() {
  const { taskId, teamSlugOrId, runId } = Route.useParams();
  const { socket } = useSocket();
  const { theme } = useTheme();
  const { addTaskToExpand } = useExpandTasks();
  const createTask = useMutation(api.tasks.create);
  const [diffControls, setDiffControls] = useState<DiffControls | null>(null);
  const [followUpText, setFollowUpText] = useState("");
  const [isRestartingTask, setIsRestartingTask] = useState(false);
  const [overridePrompt, setOverridePrompt] = useState(false);
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
  const restartProvider = selectedRun?.vscode?.provider;
  const restartRunEnvironmentId = selectedRun?.environmentId;
  const taskEnvironmentId = task?.environmentId;
  const restartIsCloudMode = useMemo(() => {
    if (restartProvider === "docker") {
      return false;
    }
    if (restartProvider) {
      return true;
    }
    if (restartRunEnvironmentId || taskEnvironmentId) {
      return true;
    }
    return false;
  }, [restartProvider, restartRunEnvironmentId, taskEnvironmentId]);
  const environmentRepos = useMemo(() => {
    const repos = selectedRun?.environment?.selectedRepos ?? [];
    const trimmed = repos
      .map((repo) => repo?.trim())
      .filter((repo): repo is string => Boolean(repo));
    return Array.from(new Set(trimmed));
  }, [selectedRun]);

  const repoFullNames = useMemo(() => {
    if (task?.projectFullName) {
      return [task.projectFullName];
    }
    return environmentRepos;
  }, [task?.projectFullName, environmentRepos]);

  const [primaryRepo, ...additionalRepos] = repoFullNames;

  const branchMetadataQuery = useRQ({
    ...convexQuery(api.github.getBranchesByRepo, {
      teamSlugOrId,
      repo: primaryRepo ?? "",
    }),
    enabled: Boolean(primaryRepo),
  });

  const branchMetadata = branchMetadataQuery.data as
    | Doc<"branches">[]
    | undefined;

  const baseBranchMetadata = useMemo(() => {
    if (!task?.baseBranch) {
      return undefined;
    }
    return branchMetadata?.find((branch) => branch.name === task.baseBranch);
  }, [branchMetadata, task?.baseBranch]);

  const metadataByRepo = useMemo(() => {
    if (!primaryRepo) return undefined;
    if (!baseBranchMetadata) return undefined;
    const { lastKnownBaseSha, lastKnownMergeCommitSha } = baseBranchMetadata;
    if (!lastKnownBaseSha && !lastKnownMergeCommitSha) {
      return undefined;
    }
    return {
      [primaryRepo]: {
        lastKnownBaseSha: lastKnownBaseSha ?? undefined,
        lastKnownMergeCommitSha: lastKnownMergeCommitSha ?? undefined,
      },
    };
  }, [primaryRepo, baseBranchMetadata]);

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

  const handleRestartTask = useCallback(async () => {
    if (!task) {
      toast.error("Task data is still loading. Try again in a moment.");
      return;
    }
    if (!socket) {
      toast.error("Socket not connected. Refresh or try again later.");
      return;
    }

    const followUp = followUpText.trim();
    if (!followUp && overridePrompt) {
      toast.error("Add new instructions when overriding the prompt.");
      return;
    }
    if (!followUp && !task.text) {
      toast.error("Add follow-up context before restarting.");
      return;
    }

    if (restartAgents.length === 0) {
      toast.error(
        "No previous agents found for this task. Start a new run from the dashboard.",
      );
      return;
    }

    const originalPrompt = task.text ?? "";
    const combinedPrompt = overridePrompt
      ? followUp
      : originalPrompt
        ? followUp
          ? `${originalPrompt}\n\n${followUp}`
          : originalPrompt
        : followUp;

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
            isCloudMode: restartIsCloudMode,
            ...(task.environmentId
              ? { environmentId: task.environmentId }
              : {}),
            theme,
          },
          (response) => {
            if ("error" in response) {
              toast.error(`Task restart error: ${response.error}`);
            } else {
              setFollowUpText("");
              toast.success("Started follow-up task");
            }
            resolve();
          },
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
    overridePrompt,
    socket,
    task,
    teamSlugOrId,
    theme,
    restartAgents,
    restartIsCloudMode,
  ]);

  const handleFormSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void handleRestartTask();
    },
    [handleRestartTask],
  );

  const trimmedFollowUp = followUpText.trim();
  const isRestartDisabled =
    isRestartingTask ||
    (overridePrompt ? !trimmedFollowUp : !trimmedFollowUp && !task?.text) ||
    !socket ||
    !task;
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
    if (overridePrompt && !trimmedFollowUp) {
      return "Add new instructions";
    }
    if (!trimmedFollowUp && !task?.text) {
      return "Add follow-up context";
    }
    return undefined;
  }, [isRestartingTask, overridePrompt, socket, task, trimmedFollowUp]);

  const handleFollowUpKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (!isRestartDisabled) {
          void handleRestartTask();
        }
      }
    },
    [handleRestartTask, isRestartDisabled],
  );

  // 404 if selected run is missing
  if (!selectedRun) {
    return (
      <div className="p-6 text-sm text-neutral-600 dark:text-neutral-300">
        404 – Run not found
      </div>
    );
  }

  const baseRef = normalizeGitRef(task?.baseBranch || "main");
  const headRef = normalizeGitRef(selectedRun.newBranch);
  const hasDiffSources =
    Boolean(primaryRepo) && Boolean(baseRef) && Boolean(headRef);
  const shouldPrefixDiffs = repoFullNames.length > 1;

  return (
    <FloatingPane>
      <div className="flex h-full min-h-0 flex-col relative isolate">
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
          <TaskDetailHeader
            task={task}
            taskRuns={taskRuns ?? null}
            selectedRun={selectedRun ?? null}
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
              {hasDiffSources ? (
                <RunDiffSection
                  repoFullName={primaryRepo as string}
                  additionalRepoFullNames={additionalRepos}
                  withRepoPrefix={shouldPrefixDiffs}
                  ref1={baseRef}
                  ref2={headRef}
                  onControlsChange={setDiffControls}
                  classNames={gitDiffViewerClassNames}
                  metadataByRepo={metadataByRepo}
                />
              ) : (
                <div className="p-6 text-sm text-neutral-600 dark:text-neutral-300">
                  Missing repo or branches to show diff.
                </div>
              )}
            </Suspense>
            <div className="sticky bottom-0 z-[var(--z-popover)] border-t border-transparent px-3.5 pb-3.5 pt-2">
              <form
                onSubmit={handleFormSubmit}
                className="mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-neutral-500/15 bg-white dark:border-neutral-500/15 dark:bg-neutral-950"
              >
                <div className="px-3.5 pt-3.5">
                  <TextareaAutosize
                    value={followUpText}
                    onChange={(event) => setFollowUpText(event.target.value)}
                    onKeyDown={handleFollowUpKeyDown}
                    minRows={1}
                    maxRows={2}
                    placeholder={
                      overridePrompt
                        ? "Edit original task instructions..."
                        : "Add updated instructions or context..."
                    }
                    className="w-full max-h-24 resize-none overflow-y-auto border-none bg-transparent p-0 text-[15px] leading-relaxed text-neutral-900 outline-none placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 px-3.5 pb-3 pt-2">
                  <div className="flex items-center gap-2.5">
                    <Switch
                      isSelected={overridePrompt}
                      onValueChange={(value) => {
                        setOverridePrompt(value);
                        if (value) {
                          if (!task?.text) {
                            return;
                          }
                          const promptText = task.text;
                          setFollowUpText((current) => {
                            if (!current) {
                              return promptText;
                            }
                            if (current.includes(promptText)) {
                              return current;
                            }
                            return `${current}${promptText}`;
                          });
                        } else {
                          setFollowUpText("");
                        }
                      }}
                      size="sm"
                      aria-label="Override prompt"
                      classNames={{
                        wrapper: cn(
                          "group-data-[selected=true]:bg-neutral-600",
                          "group-data-[selected=true]:border-neutral-600",
                          "dark:group-data-[selected=true]:bg-neutral-500",
                          "dark:group-data-[selected=true]:border-neutral-500",
                        ),
                      }}
                    />
                    <span className="text-xs leading-tight text-neutral-500 dark:text-neutral-400">
                      {overridePrompt
                        ? "Override initial prompt"
                        : task?.text
                          ? "Original prompt included"
                          : "New task prompt"}
                    </span>
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
              </form>
            </div>
          </div>
        </div>
      </div>
    </FloatingPane>
  );
}
