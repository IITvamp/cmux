import { ElectronPreviewBrowser } from "@/components/electron-preview-browser";
import { getTaskRunPreviewPersistKey } from "@/lib/persistent-webview-keys";
import { preloadTaskRunPreviewIframe } from "@/lib/preloadTaskRunIframes";
import { Loader2 } from "lucide-react";
import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useEffect, useMemo, useRef } from "react";
import z from "zod";

const paramsSchema = z.object({
  taskId: typedZid("tasks"),
  runId: typedZid("taskRuns"),
  port: z.string(),
});

export const Route = createFileRoute(
  "/_layout/$teamSlugOrId/task/$taskId/run/$runId/preview/$port",
)({
  component: PreviewPage,
  params: {
    parse: paramsSchema.parse,
    stringify: (params) => {
      return {
        taskId: params.taskId,
        runId: params.runId,
        port: params.port,
      };
    },
  },
});

function PreviewPage() {
  const { taskId, teamSlugOrId, runId, port } = Route.useParams();

  const taskRuns = useQuery(api.taskRuns.getByTask, {
    teamSlugOrId,
    taskId,
  });

  // Get the specific run
  const selectedRun = useMemo(() => {
    return taskRuns?.find((run) => run._id === runId);
  }, [runId, taskRuns]);

  const selectedService = useMemo(() => {
    if (!selectedRun?.networking) return null;
    const portNum = Number.parseInt(port, 10);
    return (
      selectedRun.networking.find((service) => service.port === portNum) ?? null
    );
  }, [port, selectedRun]);

  const serviceStatus = selectedService?.status ?? null;
  const isServiceRunning = serviceStatus === "running";
  const isServiceStarting = serviceStatus === "starting";
  const previewUrl = isServiceRunning ? selectedService?.url ?? null : null;

  const hasAttemptedPreloadRef = useRef(false);

  useEffect(() => {
    if (!isServiceRunning || !previewUrl || hasAttemptedPreloadRef.current) {
      return;
    }

    hasAttemptedPreloadRef.current = true;
    void preloadTaskRunPreviewIframe(runId, port, previewUrl).catch((error) => {
      console.warn("Failed to preload preview iframe", error);
    });
  }, [isServiceRunning, port, previewUrl, runId]);

  const persistKey = useMemo(() => {
    return getTaskRunPreviewPersistKey(runId, port);
  }, [runId, port]);

  const paneBorderRadius = 6;

  const availableRunningPorts = useMemo(() => {
    if (!selectedRun?.networking) return [] as number[];
    return selectedRun.networking
      .filter((service) => service.status === "running")
      .map((service) => service.port);
  }, [selectedRun]);

  const isTaskRunsLoading = taskRuns === undefined;
  const showLoadingState = isTaskRunsLoading || isServiceStarting;
  const showStoppedState = Boolean(
    selectedService && selectedService.status === "stopped",
  );
  const isRunMissing = Boolean(!isTaskRunsLoading && !selectedRun);

  return (
    <div className="flex h-full flex-col bg-white dark:bg-neutral-950">
      <div className="flex-1 min-h-0">
        {previewUrl ? (
          <ElectronPreviewBrowser
            persistKey={persistKey}
            src={previewUrl}
            borderRadius={paneBorderRadius}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              {showLoadingState ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {isServiceStarting
                      ? `Waiting for dev server on port ${port}...`
                      : "Loading run details..."}
                  </p>
                </div>
              ) : (
                <p className="mb-2 text-sm text-neutral-500 dark:text-neutral-400">
                  {showStoppedState
                    ? `Port ${port} preview has stopped.`
                    : isRunMissing
                      ? "Task run could not be found."
                      : `Port ${port} is not available for this run.`}
                </p>
              )}
              {selectedRun?.networking && selectedRun.networking.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs text-neutral-400 dark:text-neutral-500">
                    Available ports:
                  </p>
                  <div className="flex justify-center gap-2">
                    {availableRunningPorts.length > 0 ? (
                      availableRunningPorts.map((runningPort) => (
                        <span
                          key={runningPort}
                          className="rounded px-2 py-1 text-xs bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
                        >
                          {runningPort}
                        </span>
                      ))
                    ) : (
                      <span className="rounded px-2 py-1 text-xs bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-200">
                        None running yet
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
