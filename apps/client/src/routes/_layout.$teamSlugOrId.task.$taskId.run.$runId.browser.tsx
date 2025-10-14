import { PersistentWebView } from "@/components/persistent-webview";
import {
  TASK_RUN_IFRAME_ALLOW,
  TASK_RUN_IFRAME_SANDBOX,
} from "../lib/preloadTaskRunIframes";
import { getTaskRunBrowserPersistKey } from "@/lib/persistent-webview-keys";
import { toProxyBrowserUrl } from "@/lib/toProxyWorkspaceUrl";
import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import clsx from "clsx";
import { useCallback, useMemo } from "react";
import z from "zod";

const paramsSchema = z.object({
  taskId: typedZid("tasks"),
  runId: typedZid("taskRuns"),
});

export const Route = createFileRoute(
  "/_layout/$teamSlugOrId/task/$taskId/run/$runId/browser"
)({
  component: TaskRunBrowserComponent,
  params: {
    parse: paramsSchema.parse,
    stringify: (params) => ({
      taskId: params.taskId,
      runId: params.runId,
    }),
  },
  loader: async (opts) => {
    await opts.context.queryClient.ensureQueryData(
      convexQuery(api.taskRuns.get, {
        teamSlugOrId: opts.params.teamSlugOrId,
        id: opts.params.runId,
      })
    );
  },
});

function TaskRunBrowserComponent() {
  const { runId: taskRunId, teamSlugOrId } = Route.useParams();
  const taskRun = useSuspenseQuery(
    convexQuery(api.taskRuns.get, {
      teamSlugOrId,
      id: taskRunId,
    })
  );

  const persistKey = useMemo(
    () => getTaskRunBrowserPersistKey(taskRunId),
    [taskRunId]
  );

  const browserUrl = useMemo(() => {
    const vscodeInfo = taskRun?.data?.vscode;
    if (!vscodeInfo || vscodeInfo.provider !== "morph" || !vscodeInfo.url) {
      return null;
    }

    try {
      return toProxyBrowserUrl(vscodeInfo.url);
    } catch (error) {
      console.error(
        `Failed to derive browser URL for task run ${taskRunId}:`,
        error
      );
      return null;
    }
  }, [taskRun, taskRunId]);

  const onLoad = useCallback(() => {
    if (browserUrl) {
      console.log(`Browser view loaded for task run ${taskRunId}`);
    }
  }, [browserUrl, taskRunId]);

  const onError = useCallback(
    (error: Error) => {
      console.error(
        `Failed to load browser view for task run ${taskRunId}:`,
        error
      );
    },
    [taskRunId]
  );

  const helperText = useMemo(() => {
    if (!taskRun?.data?.vscode) {
      return "Browser view is unavailable for this run.";
    }

    if (taskRun.data.vscode.provider !== "morph") {
      return "Browser view is only available for cloud runs.";
    }

    if (!browserUrl) {
      return "Browser view is not ready yet.";
    }

    return null;
  }, [browserUrl, taskRun]);

  return (
    <div className="pl-1 flex flex-col grow bg-neutral-50 dark:bg-black">
      <div className="flex flex-col grow min-h-0 border-l border-neutral-200 dark:border-neutral-800">
        <div className="flex flex-row grow min-h-0 relative">
          {browserUrl ? (
            <PersistentWebView
              persistKey={persistKey}
              src={browserUrl}
              className="grow flex relative"
              iframeClassName="select-none"
              allow={TASK_RUN_IFRAME_ALLOW}
              sandbox={TASK_RUN_IFRAME_SANDBOX}
              retainOnUnmount
              suspended={!browserUrl}
              onLoad={onLoad}
              onError={onError}
            />
          ) : (
            <div className="grow" />
          )}

          {helperText ? (
            <div
              className={clsx(
                "absolute inset-0 flex items-center justify-center transition pointer-events-none",
                {
                  "opacity-100": !browserUrl,
                  "opacity-0": browserUrl,
                }
              )}
            >
              <span className="px-4 text-sm text-center text-neutral-500 dark:text-neutral-400">
                {helperText}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
