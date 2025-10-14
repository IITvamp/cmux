import { ElectronPreviewBrowser } from "@/components/electron-preview-browser";
import { getTaskRunPreviewPersistKey } from "@/lib/persistent-webview-keys";
import { preloadTaskRunIframe } from "@/lib/preloadTaskRunIframes";
import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useCallback, useEffect, useMemo } from "react";
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

  // Find the service URL for the requested port
  const previewUrl = useMemo(() => {
    if (!selectedRun?.networking) return null;
    const portNum = parseInt(port, 10);
    const service = selectedRun.networking.find(
      (s) => s.port === portNum && s.status === "running" && s.devServerReady === true,
    );
    return service?.url;
  }, [selectedRun, port]);

  const persistKey = useMemo(() => {
    return getTaskRunPreviewPersistKey(runId, port);
  }, [runId, port]);

  // Check if dev server is starting (service running but not ready)
  const isDevServerStarting = useMemo(() => {
    if (!selectedRun?.networking) return false;
    const portNum = parseInt(port, 10);
    const service = selectedRun.networking.find(
      (s) => s.port === portNum && s.status === "running",
    );
    return service && service.devServerReady === false;
  }, [selectedRun, port]);

  const paneBorderRadius = 6;

  // Function to check dev server readiness
  const checkDevServerReady = useCallback(async () => {
    if (!selectedRun || !isDevServerStarting) return;

    try {
      const response = await fetch(`/api/sandboxes/${teamSlugOrId}/task-runs/${runId}/check-dev-server-ready`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ port: parseInt(port, 10) }),
      });

      if (response.ok) {
        // The mutation will update the convex state, which will trigger a re-render
        console.log(`Dev server readiness checked for port ${port}`);
      }
    } catch (error) {
      console.error('Failed to check dev server readiness:', error);
    }
  }, [selectedRun, isDevServerStarting, teamSlugOrId, runId, port]);

  // Periodically check dev server readiness when starting
  useEffect(() => {
    if (!isDevServerStarting) return;

    // Check immediately
    checkDevServerReady();

    // Then check every 2 seconds
    const interval = setInterval(checkDevServerReady, 2000);

    return () => clearInterval(interval);
  }, [isDevServerStarting, checkDevServerReady]);

  // Preload the preview iframe when it becomes available
  useEffect(() => {
    if (previewUrl) {
      preloadTaskRunIframe(runId, previewUrl).catch((error) => {
        console.error('Failed to preload preview iframe:', error);
      });
    }
  }, [previewUrl, runId]);

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
              {isDevServerStarting ? (
                <>
                  <div className="flex gap-1 mb-3">
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
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Starting dev server on port {port}...
                  </p>
                </>
              ) : (
                <p className="mb-2 text-sm text-neutral-500 dark:text-neutral-400">
                  {selectedRun
                    ? `Port ${port} is not available for this run`
                    : "Loading..."}
                </p>
              )}
              {selectedRun?.networking && selectedRun.networking.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs text-neutral-400 dark:text-neutral-500">
                    Available ports:
                  </p>
                  <div className="flex justify-center gap-2">
                    {selectedRun.networking
                      .filter((s) => s.status === "running")
                      .map((service) => (
                        <span
                          key={service.port}
                          className="rounded px-2 py-1 text-xs bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
                        >
                          {service.port}
                        </span>
                      ))}
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
