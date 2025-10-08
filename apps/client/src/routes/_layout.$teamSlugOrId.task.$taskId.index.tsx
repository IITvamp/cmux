import { FloatingPane } from "@/components/floating-pane";
import { PersistentWebView } from "@/components/persistent-webview";
import { TaskTimeline } from "@/components/task-timeline";
import { VerticalResizablePanels } from "@/components/vertical-resizable-panels";
import { Button } from "@/components/ui/button";
import { getTaskRunPersistKey } from "@/lib/persistent-webview-keys";
import { preloadTaskRunIframe } from "@/lib/preloadTaskRunIframes";
import { toProxyWorkspaceUrl } from "@/lib/toProxyWorkspaceUrl";
import { api } from "@cmux/convex/api";
import type { Doc } from "@cmux/convex/dataModel";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import { convexQuery } from "@convex-dev/react-query";
import { Switch } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import z from "zod";

import type { TaskRunWithChildren } from "@/types/task";

const WORKSPACE_IFRAME_ALLOW =
  "clipboard-read; clipboard-write; usb; serial; hid; cross-origin-isolated; autoplay; camera; microphone; geolocation; payment; fullscreen";
const WORKSPACE_IFRAME_SANDBOX =
  "allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-top-navigation";

const paramsSchema = z.object({
  taskId: typedZid("tasks"),
});

export const Route = createFileRoute("/_layout/$teamSlugOrId/task/$taskId/")({
  component: TaskDetailPage,
  params: {
    parse: paramsSchema.parse,
    stringify: (params) => {
      return {
        taskId: params.taskId,
      };
    },
  },
  validateSearch: (search: Record<string, unknown>) => {
    const runId = typedZid("taskRuns").optional().parse(search.runId);
    return {
      runId: runId,
    };
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
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.crown.getCrownEvaluation, {
          teamSlugOrId: opts.params.teamSlugOrId,
          taskId: opts.params.taskId,
        })
      ),
    ]);
  },
});

function flattenTaskRuns(runs: TaskRunWithChildren[] | null | undefined) {
  if (!runs) return [] as TaskRunWithChildren[];
  const result: TaskRunWithChildren[] = [];
  const walk = (items: TaskRunWithChildren[]) => {
    for (const item of items) {
      result.push(item);
      if (item.children && item.children.length > 0) {
        walk(item.children);
      }
    }
  };
  walk(runs);
  return result;
}

function pickPreferredWorkspaceRun(
  runs: TaskRunWithChildren[]
): TaskRunWithChildren | null {
  if (runs.length === 0) return null;
  const withWorkspace = runs.filter((run) => {
    const url = run.vscode?.workspaceUrl;
    return typeof url === "string" && url.trim().length > 0;
  });
  if (withWorkspace.length === 0) return null;

  const crowned = withWorkspace.find((run) => run.isCrowned);
  if (crowned) return crowned;

  const sortedByRecent = [...withWorkspace].sort((a, b) => {
    const aTime = a.completedAt ?? a.updatedAt ?? a.createdAt;
    const bTime = b.completedAt ?? b.updatedAt ?? b.createdAt;
    return bTime - aTime;
  });
  return sortedByRecent[0] ?? null;
}

function formatWorkspaceLabel(run: Doc<"taskRuns"> | null | undefined) {
  if (!run) return "";
  const agent = run.agentName?.trim();
  if (agent) return agent;
  return `Run ${new Date(run.createdAt).toLocaleString()}`;
}

function TaskDetailPage() {
  const { taskId, teamSlugOrId } = Route.useParams();

  const task = useSuspenseQuery(
    convexQuery(api.tasks.getById, {
      teamSlugOrId,
      id: taskId,
    })
  );
  const taskRuns = useSuspenseQuery(
    convexQuery(api.taskRuns.getByTask, {
      teamSlugOrId,
      taskId,
    })
  );
  const crownEvaluation = useSuspenseQuery(
    convexQuery(api.crown.getCrownEvaluation, {
      teamSlugOrId,
      taskId,
    })
  );

  const flattenedRuns = useMemo(
    () => flattenTaskRuns(taskRuns.data),
    [taskRuns.data]
  );

  const workspaceRun = useMemo(
    () => pickPreferredWorkspaceRun(flattenedRuns),
    [flattenedRuns]
  );

  const workspaceRunId = workspaceRun?._id ?? null;
  const workspaceUrl = useMemo(() => {
    const url = workspaceRun?.vscode?.workspaceUrl;
    if (!url) return null;
    return toProxyWorkspaceUrl(url);
  }, [workspaceRun?.vscode?.workspaceUrl]);

  const workspacePersistKey = workspaceRunId
    ? getTaskRunPersistKey(workspaceRunId)
    : null;

  useEffect(() => {
    if (!workspaceRunId || !workspaceUrl) return;
    void preloadTaskRunIframe(workspaceRunId, workspaceUrl);
  }, [workspaceRunId, workspaceUrl]);

  const heightStorageKey = `task-detail:workspace-height:${taskId}`;
  const visibilityStorageKey = `task-detail:workspace-visible:${taskId}`;
  const [showWorkspace, setShowWorkspace] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem(visibilityStorageKey);
    if (stored === null) return true;
    return stored === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(visibilityStorageKey, showWorkspace ? "1" : "0");
  }, [showWorkspace, visibilityStorageKey]);

  const workspaceStatus = workspaceRun?.vscode?.status ?? null;
  const workspaceLabel = useMemo(
    () => formatWorkspaceLabel(workspaceRun),
    [workspaceRun]
  );
  const canShowWorkspace = Boolean(workspaceUrl);
  const workspaceVisible = canShowWorkspace && showWorkspace;

  const statusIndicator = workspaceStatus ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-200">
      <span
        className="inline-flex size-2 rounded-full"
        style={{
          backgroundColor:
            workspaceStatus === "running"
              ? "#16a34a"
              : workspaceStatus === "starting"
                ? "#f59e0b"
                : "#6b7280",
        }}
      />
      {workspaceStatus.charAt(0).toUpperCase() + workspaceStatus.slice(1)}
    </span>
  ) : null;

  const openWorkspaceButton = workspaceUrl ? (
    <Button variant="outline" size="sm" asChild>
      <a href={workspaceUrl} target="_blank" rel="noopener noreferrer">
        Open in new tab
        <ExternalLink className="size-3.5" aria-hidden="true" />
      </a>
    </Button>
  ) : (
    <Button variant="outline" size="sm" disabled>
      Open in new tab
      <ExternalLink className="size-3.5" aria-hidden="true" />
    </Button>
  );

  const workspaceContent = workspacePersistKey && workspaceUrl ? (
    <div className="flex h-full min-h-0 flex-col bg-neutral-950">
      <div className="relative flex-1 min-h-0">
        <PersistentWebView
          persistKey={workspacePersistKey}
          src={workspaceUrl}
          className="flex h-full min-h-0 flex-1"
          iframeClassName="h-full w-full select-none"
          allow={WORKSPACE_IFRAME_ALLOW}
          sandbox={WORKSPACE_IFRAME_SANDBOX}
          retainOnUnmount
        />
        {workspaceStatus === "starting" ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-neutral-950/70">
            <div className="flex items-center gap-2 text-sm font-medium text-neutral-200">
              <Loader2 className="size-4 animate-spin" />
              Preparing VS Code workspace...
            </div>
          </div>
        ) : null}
      </div>
    </div>
  ) : (
    <div className="flex h-full items-center justify-center bg-neutral-50 text-sm text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
      No VS Code workspace is available for this task yet.
    </div>
  );

  const timelineContent = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <TaskTimeline
            task={task.data}
            taskRuns={taskRuns.data}
            crownEvaluation={crownEvaluation.data}
          />
        </div>
      </div>
    </div>
  );

  return (
    <FloatingPane>
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/70">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Embedded VS Code
                {workspaceLabel ? (
                  <span className="truncate text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    {workspaceLabel}
                  </span>
                ) : null}
                {statusIndicator}
              </div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                {canShowWorkspace
                  ? workspaceVisible
                    ? "Resize the panels below or open the workspace in a new tab."
                    : "Toggle the switch to reveal the embedded VS Code workspace."
                  : "Run the task to provision a workspace for this task run."}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {openWorkspaceButton}
              <label className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                <Switch
                  size="sm"
                  color="primary"
                  isSelected={workspaceVisible}
                  isDisabled={!canShowWorkspace}
                  onValueChange={setShowWorkspace}
                  aria-label="Show embedded VS Code"
                />
                Show workspace
              </label>
            </div>
          </div>
        </div>

        {workspaceVisible ? (
          <VerticalResizablePanels
            top={workspaceContent}
            bottom={timelineContent}
            storageKey={heightStorageKey}
            minTopHeight={240}
            minBottomHeight={260}
          />
        ) : (
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            {timelineContent}
          </div>
        )}
      </div>
    </FloatingPane>
  );
}
