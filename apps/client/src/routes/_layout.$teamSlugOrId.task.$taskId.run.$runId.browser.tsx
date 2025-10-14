import { PersistentWebView } from "@/components/persistent-webview";
import { getTaskRunBrowserPersistKey } from "@/lib/persistent-webview-keys";
import {
  TASK_RUN_IFRAME_ALLOW,
  TASK_RUN_IFRAME_SANDBOX,
} from "@/lib/preloadTaskRunIframes";
import { toMorphVncUrl } from "@/lib/toProxyWorkspaceUrl";
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
  component: BrowserComponent,
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

function BrowserComponent() {
  const { runId: taskRunId, teamSlugOrId } = Route.useParams();
  const taskRun = useSuspenseQuery(
    convexQuery(api.taskRuns.get, {
      teamSlugOrId,
      id: taskRunId,
    })
  );

  const vscodeInfo = taskRun?.data?.vscode;
  const rawMorphUrl = vscodeInfo?.url ?? vscodeInfo?.workspaceUrl ?? null;
  const vncUrl = useMemo(() => {
    if (!rawMorphUrl) {
      return null;
    }
    return toMorphVncUrl(rawMorphUrl);
  }, [rawMorphUrl]);

  const persistKey = getTaskRunBrowserPersistKey(taskRunId);
  const hasBrowserView = Boolean(vncUrl);
  const isMorphProvider = vscodeInfo?.provider === "morph";
  const showLoader = isMorphProvider && !hasBrowserView;

  const overlayMessage = useMemo(() => {
    if (!isMorphProvider) {
      return "Browser is only available for Morph-based runs.";
    }
    if (!hasBrowserView) {
      return "Waiting for Morph workspace to expose the browser...";
    }
    return "Launching browser...";
  }, [hasBrowserView, isMorphProvider]);

  const onLoad = useCallback(() => {
    console.log(`Browser view loaded for task run ${taskRunId}`);
  }, [taskRunId]);

  const onError = useCallback(
    (error: Error) => {
      console.error(
        `Failed to load browser view for task run ${taskRunId}:`,
        error
      );
    },
    [taskRunId]
  );

  return (
    <div className="pl-1 flex flex-col grow bg-neutral-50 dark:bg-black">
      <div className="flex flex-col grow min-h-0 border-l border-neutral-200 dark:border-neutral-800">
        <div className="flex flex-row grow min-h-0 relative">
          {vncUrl ? (
            <PersistentWebView
              persistKey={persistKey}
              src={vncUrl}
              className="grow flex relative"
              iframeClassName="select-none"
              sandbox={TASK_RUN_IFRAME_SANDBOX}
              allow={TASK_RUN_IFRAME_ALLOW}
              retainOnUnmount
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
                "opacity-100": !hasBrowserView,
                "opacity-0": hasBrowserView,
              }
            )}
          >
            <div className="flex flex-col items-center gap-3 text-center px-4">
              {showLoader ? (
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
              ) : null}
              <span className="text-sm text-neutral-500 dark:text-neutral-400">
                {overlayMessage}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
