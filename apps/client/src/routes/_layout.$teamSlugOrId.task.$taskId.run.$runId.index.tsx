import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import clsx from "clsx";
import { useCallback } from "react";
import z from "zod";
import { PersistentWebView } from "@/components/persistent-webview";
import { ResizableRows } from "@/components/ResizableRows";
import { TaskRunChatPanel } from "@/components/task-run-chat-panel";
import { getTaskRunPersistKey } from "@/lib/persistent-webview-keys";
import { toProxyWorkspaceUrl } from "@/lib/toProxyWorkspaceUrl";
import { preloadTaskRunIframes } from "../lib/preloadTaskRunIframes";

const paramsSchema = z.object({
  taskId: typedZid("tasks"),
  runId: typedZid("taskRuns"),
});

type RouteParams = z.infer<typeof paramsSchema> & {
  taskRunId: z.infer<typeof paramsSchema>["runId"];
};

export const Route = createFileRoute(
  "/_layout/$teamSlugOrId/task/$taskId/run/$runId/"
)({
  component: TaskRunComponent,
  params: {
    parse: (params): RouteParams => {
      const parsed = paramsSchema.parse(params);
      return {
        ...parsed,
        taskRunId: parsed.runId,
      };
    },
    stringify: (params) => ({
      taskId: params.taskId,
      runId: params.runId,
    }),
  },
  loader: async (opts) => {
    const { teamSlugOrId, taskId, runId } = opts.params;
    const { queryClient } = opts.context;

    const taskRunQuery = convexQuery(api.taskRuns.get, {
      teamSlugOrId,
      id: runId,
    });
    const taskQuery = convexQuery(api.tasks.getById, {
      teamSlugOrId,
      id: taskId,
    });
    const taskRunsQuery = convexQuery(api.taskRuns.getByTask, {
      teamSlugOrId,
      taskId,
    });
    const crownQuery = convexQuery(api.crown.getCrownEvaluation, {
      teamSlugOrId,
      taskId,
    });

    const [result] = await Promise.all([
      queryClient.ensureQueryData(taskRunQuery),
      queryClient.ensureQueryData(taskQuery),
      queryClient.ensureQueryData(taskRunsQuery),
      queryClient.ensureQueryData(crownQuery),
    ]);

    if (result) {
      const workspaceUrl = result.vscode?.workspaceUrl;
      void preloadTaskRunIframes([
        {
          url: workspaceUrl ? toProxyWorkspaceUrl(workspaceUrl) : "",
          taskRunId: runId,
        },
      ]);
    }
  },
});

function TaskRunComponent() {
  const { taskId, taskRunId, teamSlugOrId } = Route.useParams();
  const taskRun = useSuspenseQuery(
    convexQuery(api.taskRuns.get, {
      teamSlugOrId,
      id: taskRunId,
    })
  );
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

  const taskData = task?.data ?? null;
  const taskRunsData = taskRuns?.data ?? null;
  const crownEvaluationData = crownEvaluation?.data ?? null;

  const rawWorkspaceUrl = taskRun?.data?.vscode?.workspaceUrl ?? null;
  const workspaceUrl = rawWorkspaceUrl
    ? toProxyWorkspaceUrl(rawWorkspaceUrl)
    : null;
  const persistKey = getTaskRunPersistKey(taskRunId);
  const hasWorkspace = workspaceUrl !== null;

  const onLoad = useCallback(() => {
    console.log(`Workspace view loaded for task run ${taskRunId}`);
  }, [taskRunId]);

  const onError = useCallback(
    (error: Error) => {
      console.error(
        `Failed to load workspace view for task run ${taskRunId}:`,
        error
      );
    },
    [taskRunId]
  );

  return (
    <div className="pl-1 flex flex-col grow bg-neutral-50 dark:bg-black min-h-0">
      <div className="flex flex-col grow min-h-0 border-l border-neutral-200 dark:border-neutral-800">
        <ResizableRows
          storageKey={`taskRun-${taskRunId}-split`}
          defaultTopHeight={80}
          minTop={60}
          maxTop={90}
          className="h-full"
          top={
            <div className="relative h-full flex bg-neutral-50 dark:bg-black">
              {workspaceUrl ? (
                <PersistentWebView
                  persistKey={persistKey}
                  src={workspaceUrl}
                  className="grow flex"
                  iframeClassName="select-none"
                  sandbox="allow-downloads allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation allow-top-navigation-by-user-activation"
                  allow="accelerometer; camera; encrypted-media; fullscreen; geolocation; gyroscope; magnetometer; microphone; midi; payment; usb; xr-spatial-tracking"
                  retainOnUnmount
                  suspended={!hasWorkspace}
                  onLoad={onLoad}
                  onError={onError}
                />
              ) : (
                <div className="grow" />
              )}
              <div
                className={clsx(
                  "absolute inset-0 flex items-center justify-center transition pointer-events-none",
                  {
                    "opacity-100": !hasWorkspace,
                    "opacity-0": hasWorkspace,
                  }
                )}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="flex gap-1">
                    <div
                      className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <div
                      className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <div
                      className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                  <span className="text-sm text-neutral-500">
                    Starting VS Code...
                  </span>
                </div>
              </div>
            </div>
          }
          bottom={
            <div className="h-full bg-white dark:bg-neutral-950 flex">
              <TaskRunChatPanel
                task={taskData}
                taskRuns={taskRunsData}
                crownEvaluation={crownEvaluationData}
              />
            </div>
          }
        />
      </div>
    </div>
  );
}
