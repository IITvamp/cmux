import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { PersistentWebView } from "@/components/persistent-webview";
import { getTaskRunPersistKey } from "@/lib/persistent-webview-keys";
import { toProxyWorkspaceUrl } from "@/lib/toProxyWorkspaceUrl";
import {
  TASK_RUN_IFRAME_ALLOW,
  TASK_RUN_IFRAME_SANDBOX,
  preloadTaskRunIframes,
  preloadTaskRunPreviewIframes,
} from "../lib/preloadTaskRunIframes";

export const Route = createFileRoute(
  "/_layout/$teamSlugOrId/task/$taskId/run/$runId/"
)({
  component: TaskRunComponent,
  parseParams: (params) => ({
    ...params,
    taskRunId: typedZid("taskRuns").parse(params.runId),
  }),
  loader: async (opts) => {
    const result = await opts.context.queryClient.ensureQueryData(
      convexQuery(api.taskRuns.get, {
        teamSlugOrId: opts.params.teamSlugOrId,
        id: opts.params.taskRunId,
      })
    );
    if (result) {
      const workspaceUrl = result.vscode?.workspaceUrl;
      void preloadTaskRunIframes([
        {
          url: workspaceUrl ? toProxyWorkspaceUrl(workspaceUrl) : "",
          taskRunId: opts.params.taskRunId,
        },
      ]);
    }
  },
});

function TaskRunComponent() {
  const { taskRunId, teamSlugOrId } = Route.useParams();
  const taskRun = useSuspenseQuery(
    convexQuery(api.taskRuns.get, {
      teamSlugOrId,
      id: taskRunId,
    })
  );

  const runData = taskRun.data;
  const rawWorkspaceUrl = runData?.vscode?.workspaceUrl ?? null;
  const workspaceUrl = rawWorkspaceUrl
    ? toProxyWorkspaceUrl(rawWorkspaceUrl)
    : null;
  const persistKey = getTaskRunPersistKey(taskRunId);
  const vscodeStatus = runData?.vscode?.status ?? null;
  const hasWorkspaceUrl = workspaceUrl !== null;
  const isVSCodeRunning = hasWorkspaceUrl && vscodeStatus === "running";
  const isVSCodeStarting = vscodeStatus === "starting";
  const showVSCodeOverlay = !isVSCodeRunning;

  const vscodeStatusMessage = useMemo(() => {
    if (isVSCodeRunning) return null;
    if (isVSCodeStarting) return "Starting VS Code...";
    if (vscodeStatus === "stopped") return "VS Code workspace has stopped.";
    if (!hasWorkspaceUrl) return "Waiting for VS Code workspace...";
    return "Preparing VS Code...";
  }, [hasWorkspaceUrl, isVSCodeRunning, isVSCodeStarting, vscodeStatus]);

  const overlayMessage = vscodeStatusMessage ?? "Preparing VS Code...";

  const preloadedPreviewKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const networking = runData?.networking;
    if (!networking) return;

    const runningServices = networking.filter(
      (service) => service.status === "running"
    );
    if (runningServices.length === 0) return;

    const servicesToPreload = runningServices.filter((service) => {
      const key = `${service.port}:${service.url}`;
      if (preloadedPreviewKeysRef.current.has(key)) {
        return false;
      }
      preloadedPreviewKeysRef.current.add(key);
      return true;
    });

    if (servicesToPreload.length === 0) {
      return;
    }

    void preloadTaskRunPreviewIframes(
      servicesToPreload.map((service) => ({
        taskRunId,
        port: service.port,
        url: service.url,
      }))
    ).catch((error) => {
      servicesToPreload.forEach((service) => {
        const key = `${service.port}:${service.url}`;
        preloadedPreviewKeysRef.current.delete(key);
      });
      console.warn("Failed to preload preview iframe(s)", error);
    });
  }, [runData?.networking, taskRunId]);

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
    <div className="pl-1 flex flex-col grow bg-neutral-50 dark:bg-black">
      <div className="flex flex-col grow min-h-0 border-l border-neutral-200 dark:border-neutral-800">
        <div className="flex flex-row grow min-h-0 relative">
          {workspaceUrl ? (
            <PersistentWebView
              persistKey={persistKey}
              src={workspaceUrl}
              className="grow flex relative"
              iframeClassName="select-none"
              allow={TASK_RUN_IFRAME_ALLOW}
              sandbox={TASK_RUN_IFRAME_SANDBOX}
              retainOnUnmount
              suspended={!isVSCodeRunning}
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
                "opacity-100": showVSCodeOverlay,
                "opacity-0": !showVSCodeOverlay,
              }
            )}
          >
            {showVSCodeOverlay ? (
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
                  {overlayMessage}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
