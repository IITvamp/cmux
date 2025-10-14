import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
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

  const workspaceUrl = taskRun?.data?.vscode?.workspaceUrl
    ? toProxyWorkspaceUrl(taskRun.data.vscode.workspaceUrl)
    : null;
  const persistKey = getTaskRunPersistKey(taskRunId);
  const hasWorkspace = workspaceUrl !== null;
  type FrameStatus = "waiting" | "loading" | "ready" | "error";
  const [frameStatus, setFrameStatus] = useState<FrameStatus>("waiting");
  const [loadError, setLoadError] = useState<Error | null>(null);

  useEffect(() => {
    setLoadError(null);
    setFrameStatus(workspaceUrl ? "loading" : "waiting");
  }, [workspaceUrl]);

  const onLoad = useCallback(() => {
    setFrameStatus("ready");
    console.log(`Workspace view loaded for task run ${taskRunId}`);
  }, [taskRunId]);

  const onError = useCallback(
    (error: Error) => {
      setLoadError(error);
      setFrameStatus("error");
      console.error(
        `Failed to load workspace view for task run ${taskRunId}:`,
        error
      );
    },
    [taskRunId]
  );

  const showOverlay = frameStatus !== "ready";
  const statusMessage = useMemo(() => {
    if (frameStatus === "error") {
      return "We hit an issue while starting VS Code. Retrying might help.";
    }

    if (frameStatus === "loading") {
      return "Starting your VS Code workspace...";
    }

    return "Preparing your VS Code workspace...";
  }, [frameStatus]);

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
              suspended={!hasWorkspace || frameStatus !== "ready"}
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
                "opacity-100": showOverlay,
                "opacity-0": !showOverlay,
              }
            )}
          >
            <div className="flex flex-col items-center gap-3 text-center px-6">
              <div className="relative h-10 w-10">
                <span className="absolute inset-0 rounded-full border-2 border-neutral-200 dark:border-neutral-800" />
                <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 border-l-blue-500 animate-spin [animation-duration:1s]" />
              </div>
              <span className="text-sm text-neutral-600 dark:text-neutral-300">
                {statusMessage}
              </span>
              {frameStatus === "error" && loadError ? (
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {loadError.message}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
