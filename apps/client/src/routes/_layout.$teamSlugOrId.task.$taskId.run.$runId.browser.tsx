import { PersistentWebView } from "@/components/persistent-webview";
import {
  TASK_RUN_IFRAME_ALLOW,
  TASK_RUN_IFRAME_SANDBOX,
} from "../lib/preloadTaskRunIframes";
import { getTaskRunBrowserPersistKey } from "@/lib/persistent-webview-keys";
import { toMorphVncUrl } from "@/lib/morphWorkspace";
import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import clsx from "clsx";
import { useCallback } from "react";
import z from "zod";

const paramsSchema = z.object({
  taskId: typedZid("tasks"),
  runId: typedZid("taskRuns"),
});

export const Route = createFileRoute(
  "/_layout/$teamSlugOrId/task/$taskId/run/$runId/browser"
)({
  component: TaskRunBrowser,
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

function TaskRunBrowser() {
  const { runId: taskRunId, teamSlugOrId } = Route.useParams();
  const taskRun = useSuspenseQuery(
    convexQuery(api.taskRuns.get, {
      teamSlugOrId,
      id: taskRunId,
    })
  );

  const vscode = taskRun?.data?.vscode;
  const isMorphProvider = vscode?.provider === "morph";
  const workspaceUrl = vscode?.workspaceUrl ?? null;
  const browserUrl = isMorphProvider && workspaceUrl
    ? toMorphVncUrl(workspaceUrl)
    : null;

  const persistKey = getTaskRunBrowserPersistKey(taskRunId);
  const hasBrowser = Boolean(browserUrl);

  const onLoad = useCallback(() => {
    console.log(`Browser view loaded for task run ${taskRunId}`);
  }, [taskRunId]);

  const onError = useCallback(
    (error: Error) => {
      console.error(`Failed to load browser view for task run ${taskRunId}:`, error);
    },
    [taskRunId]
  );

  return (
    <div className="pl-1 flex flex-col grow bg-neutral-50 dark:bg-black">
      <div className="flex flex-col grow min-h-0 border-l border-neutral-200 dark:border-neutral-800">
        <div className="flex flex-row grow min-h-0 relative">
          {browserUrl ? (
            <PersistentWebView
              persistKey={persistKey}
              src={browserUrl}
              className="grow flex relative"
              sandbox={TASK_RUN_IFRAME_SANDBOX}
              allow={TASK_RUN_IFRAME_ALLOW}
              retainOnUnmount
              suspended={!hasBrowser}
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
                "opacity-100": !hasBrowser,
                "opacity-0": hasBrowser,
              }
            )}
          >
            {isMorphProvider ? (
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
                  Preparing browser view...
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 px-6 text-center">
                <span className="text-sm text-neutral-500">
                  Browser view is available only for Morph cloud runs.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
