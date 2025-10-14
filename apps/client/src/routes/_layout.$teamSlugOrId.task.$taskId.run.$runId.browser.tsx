import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import clsx from "clsx";
import { useCallback, useMemo } from "react";
import z from "zod";
import { PersistentWebView } from "@/components/persistent-webview";
import { getTaskRunPersistKey } from "@/lib/persistent-webview-keys";
import {
  preloadTaskRunIframes,
  TASK_RUN_IFRAME_ALLOW,
  TASK_RUN_IFRAME_SANDBOX,
} from "../lib/preloadTaskRunIframes";

const paramsSchema = z.object({
  taskId: typedZid("tasks"),
  runId: typedZid("taskRuns"),
});

function constructVncUrl(workspaceUrl: string): string {
  // Extract morphId from workspace URL
  // Format: https://port-39378-morphvm-{morphId}.http.cloud.morph.so/?folder=/root/workspace
  const url = new URL(workspaceUrl);
  const hostname = url.hostname;
  const match = hostname.match(
    /^port-\d+-morphvm-([^.]+)\.http\.cloud\.morph\.so$/
  );

  if (!match) {
    throw new Error(`Invalid workspace URL: ${workspaceUrl}`);
  }

  const morphId = match[1];
  // Construct VNC URL with port 39380, adding query params for auto-connect and local scaling
  return `https://port-39380-morphvm-${morphId}.http.cloud.morph.so/vnc.html?autoconnect=true&resize=scale`;
}

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
    const result = await opts.context.queryClient.ensureQueryData(
      convexQuery(api.taskRuns.get, {
        teamSlugOrId: opts.params.teamSlugOrId,
        id: opts.params.runId,
      })
    );
    if (result?.vscode?.workspaceUrl) {
      try {
        const vncUrl = constructVncUrl(result.vscode.workspaceUrl);
        void preloadTaskRunIframes([
          {
            url: vncUrl,
            taskRunId: opts.params.runId,
          },
        ]);
      } catch {
        // Ignore errors during preload
      }
    }
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

  const vncUrl = useMemo(() => {
    const workspaceUrl = taskRun?.data?.vscode?.workspaceUrl;
    if (!workspaceUrl) return null;
    try {
      return constructVncUrl(workspaceUrl);
    } catch {
      return null;
    }
  }, [taskRun?.data?.vscode?.workspaceUrl]);

  const persistKey = getTaskRunPersistKey(taskRunId) + "-vnc";
  const hasVnc = vncUrl !== null;

  const onLoad = useCallback(() => {
    console.log(`Browser VNC view loaded for task run ${taskRunId}`);
  }, [taskRunId]);

  const onError = useCallback(
    (error: Error) => {
      console.error(
        `Failed to load browser VNC view for task run ${taskRunId}:`,
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
              suspended={!hasVnc}
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
                "opacity-100": !hasVnc,
                "opacity-0": hasVnc,
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
                Starting Browser...
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
