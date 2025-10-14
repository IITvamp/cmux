import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import clsx from "clsx";
import { useCallback, useState } from "react";
import z from "zod";
import { PersistentWebView } from "@/components/persistent-webview";
import { getTaskRunPersistKey } from "@/lib/persistent-webview-keys";
import { toProxyWorkspaceUrl } from "@/lib/toProxyWorkspaceUrl";
import {
  preloadTaskRunIframes,
  TASK_RUN_IFRAME_ALLOW,
  TASK_RUN_IFRAME_SANDBOX,
} from "../lib/preloadTaskRunIframes";

const paramsSchema = z.object({
  taskId: typedZid("tasks"),
  runId: typedZid("taskRuns"),
});

export const Route = createFileRoute(
  "/_layout/$teamSlugOrId/task/$taskId/run/$runId/vscode"
)({
  component: VSCodeComponent,
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
    const result = await opts.context.queryClient.ensureQueryData(
      convexQuery(api.taskRuns.get, {
        teamSlugOrId: opts.params.teamSlugOrId,
        id: opts.params.runId,
      })
    );
    if (result) {
      const workspaceUrl = result.vscode?.workspaceUrl;
      void preloadTaskRunIframes([
        {
          url: workspaceUrl ? toProxyWorkspaceUrl(workspaceUrl) : "",
          taskRunId: opts.params.runId,
        },
      ]);
    }
  },
});

function VSCodeComponent() {
  const { runId: taskRunId, teamSlugOrId } = Route.useParams();
  const taskRun = useSuspenseQuery(
    convexQuery(api.taskRuns.get, {
      teamSlugOrId,
      id: taskRunId,
    })
  );

  const [isIframeLoading, setIsIframeLoading] = useState(true);

  const workspaceUrl = taskRun?.data?.vscode?.workspaceUrl
    ? toProxyWorkspaceUrl(taskRun.data.vscode.workspaceUrl)
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

  const onLoadingChange = useCallback((isLoading: boolean) => {
    setIsIframeLoading(isLoading);
  }, []);

  return (
    <div className="pl-1 flex flex-col grow bg-neutral-50 dark:bg-black">
      <div className="flex flex-col grow min-h-0 border-l border-neutral-200 dark:border-neutral-800">
        <div className="flex flex-row grow min-h-0 relative">
          {workspaceUrl ? (
            <PersistentWebView
              persistKey={persistKey}
              src={workspaceUrl}
              className="grow flex relative"
              iframeClassName="select-none"
              sandbox={TASK_RUN_IFRAME_SANDBOX}
              allow={TASK_RUN_IFRAME_ALLOW}
              retainOnUnmount
              suspended={!hasWorkspace}
              onLoad={onLoad}
              onError={onError}
              onLoadingChange={onLoadingChange}
            />
          ) : (
            <div className="grow" />
          )}
          <div
            className={clsx(
              "absolute inset-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none bg-neutral-50 dark:bg-black",
              {
                "opacity-100": !hasWorkspace || isIframeLoading,
                "opacity-0": hasWorkspace && !isIframeLoading,
              }
            )}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-1.5">
                <div
                  className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms", animationDuration: "1s" }}
                />
                <div
                  className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce"
                  style={{ animationDelay: "150ms", animationDuration: "1s" }}
                />
                <div
                  className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce"
                  style={{ animationDelay: "300ms", animationDuration: "1s" }}
                />
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Starting VS Code instance...
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  This may take a few moments
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
