import { ElectronPreviewBrowser } from "@/components/electron-preview-browser";
import { RestoredTerminalView } from "@/components/RestoredTerminalView";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getTaskRunPreviewPersistKey } from "@/lib/persistent-webview-keys";
import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ChevronDown, ChevronUp, Terminal } from "lucide-react";
import { useMemo, useState } from "react";
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
  const [showTerminal, setShowTerminal] = useState(false);

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
      {/* Toggle Terminal Button */}
      <div className="absolute top-3 right-3 z-10">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTerminal(!showTerminal)}
              className="shadow-lg bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm border-neutral-300 dark:border-neutral-700 hover:bg-white dark:hover:bg-neutral-900"
            >
              <Terminal className="size-4" />
              {showTerminal ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronUp className="size-3" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            {showTerminal ? "Hide terminal" : "Show terminal"}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Preview Section */}
        <div
          className="transition-all duration-300 ease-in-out"
          style={{
            height: showTerminal ? "50%" : "100%",
          }}
        >
          {previewUrl ? (
            <ElectronPreviewBrowser
              persistKey={persistKey}
              src={previewUrl}
              borderRadius={paneBorderRadius}
            />
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

        {/* Terminal Section */}
        <div
          className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-950 transition-all duration-300 ease-in-out overflow-hidden"
          style={{
            height: showTerminal ? "50%" : "0",
            opacity: showTerminal ? 1 : 0,
          }}
        >
          {showTerminal && (
            <div className="h-full w-full">
              <RestoredTerminalView runId={runId} teamSlugOrId={teamSlugOrId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
