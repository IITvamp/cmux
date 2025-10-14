import { ElectronPreviewBrowser } from "@/components/electron-preview-browser";
import { RestoredTerminalView } from "@/components/RestoredTerminalView";
import { Button } from "@/components/ui/button";
import { getTaskRunPreviewPersistKey } from "@/lib/persistent-webview-keys";
import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { TerminalSquare, X } from "lucide-react";
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
  const [showTerminal, setShowTerminal] = useState(true);

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
      (s) => s.port === portNum && s.status === "running",
    );
    return service?.url;
  }, [selectedRun, port]);

  const persistKey = useMemo(() => {
    return getTaskRunPreviewPersistKey(runId, port);
  }, [runId, port]);

  const paneBorderRadius = 6;

  return (
    <div className="flex h-full flex-col bg-white dark:bg-neutral-950">
      <div className="relative flex-1 min-h-0">
        {previewUrl ? (
          <>
            <ElectronPreviewBrowser
              persistKey={persistKey}
              src={previewUrl}
              borderRadius={paneBorderRadius}
            />

            <div className="pointer-events-none absolute bottom-6 right-6 z-30 flex justify-end">
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => setShowTerminal((prev) => !prev)}
                className="pointer-events-auto h-12 w-12 rounded-full border border-neutral-200/80 bg-white/90 text-neutral-700 shadow-[0_8px_20px_rgba(15,23,42,0.12)] backdrop-blur-sm transition hover:bg-white hover:scale-105 dark:border-neutral-700/60 dark:bg-neutral-900/90 dark:text-neutral-100 dark:hover:bg-neutral-900"
                title={showTerminal ? "Hide terminal" : "Show terminal"}
              >
                <TerminalSquare className="size-5" />
              </Button>
            </div>

            <div
              className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-4 transition-transform duration-300 ease-out ${showTerminal ? "translate-y-0" : "translate-y-[calc(100%+2rem)]"}`}
            >
              <div className="pointer-events-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-neutral-200/70 bg-neutral-950/90 shadow-[0_32px_80px_-40px_rgba(15,23,42,0.7)] backdrop-blur">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                      Dev script terminal
                    </p>
                    <p className="text-sm font-medium text-white/90">
                      Streaming tmux window
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setShowTerminal(false)}
                    className="text-white/70 hover:text-white"
                    aria-label="Hide terminal"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <div className="h-[280px] bg-black">
                  {showTerminal && (
                    <RestoredTerminalView
                      runId={runId}
                      teamSlugOrId={teamSlugOrId}
                    />
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="mb-2 text-sm text-neutral-500 dark:text-neutral-400">
                {selectedRun
                  ? `Port ${port} is not available for this run`
                  : "Loading..."}
              </p>
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
