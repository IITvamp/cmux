import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import clsx from "clsx";
import { useCallback, useMemo } from "react";
import z from "zod";
import { PersistentWebView } from "@/components/persistent-webview";
import { getTaskRunBrowserPersistKey } from "@/lib/persistent-webview-keys";

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
    stringify: (params) => {
      return {
        taskId: params.taskId,
        runId: params.runId,
      };
    },
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

  const vncPort = taskRun?.data?.vscode?.ports?.vnc;
  const provider = taskRun?.data?.vscode?.provider;

  // For morph instances, construct the VNC URL
  const browserUrl = useMemo(() => {
    if (provider !== "morph" || !vncPort) {
      return null;
    }

    // vncPort should be the base URL, append /vnc.html with query params
    return `${vncPort}/vnc.html?autoconnect=true&scaling=local`;
  }, [provider, vncPort]);

  const persistKey = getTaskRunBrowserPersistKey(taskRunId);
  const hasBrowser = browserUrl !== null;

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

  if (provider !== "morph") {
    return (
      <div className="pl-1 flex flex-col grow bg-neutral-50 dark:bg-black">
        <div className="flex flex-col grow min-h-0 border-l border-neutral-200 dark:border-neutral-800">
          <div className="flex flex-col grow min-h-0 relative">
            <div className="grow flex items-center justify-center">
              <div className="text-sm text-neutral-500 dark:text-neutral-400">
                Browser view is only available for Morph cloud instances.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
              sandbox="allow-scripts allow-same-origin allow-forms"
              allow="clipboard-read; clipboard-write"
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
                Starting browser...
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}