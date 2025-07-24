import { preloadTaskRunIframes } from "@/lib/preloadTaskRunIframes";
import { getShortId } from "@coderouter/shared";
import { createFileRoute } from "@tanstack/react-router";
import "@xterm/xterm/css/xterm.css";
import { usePersistentIframe } from "../hooks/usePersistentIframe";

export const Route = createFileRoute("/_layout/task/$taskId/run/$taskRunId")({
  component: TaskRunComponent,
  loader: async (opts) => {
    void preloadTaskRunIframes([opts.params.taskRunId]);
  },
});

function TaskRunComponent() {
  const { taskRunId } = Route.useParams();
  const shortId = getShortId(taskRunId);
  const iframeUrl = `http://${shortId}.39378.localhost:3001/?folder=/root/workspace`;

  const { containerRef } = usePersistentIframe({
    key: `task-run-${taskRunId}`,
    url: iframeUrl,
    className: "rounded-md",
    allow:
      "clipboard-read; clipboard-write; usb; serial; hid; cross-origin-isolated; autoplay; camera; microphone; geolocation; payment; fullscreen",
    sandbox:
      "allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-top-navigation",
    onLoad: () => {
      console.log(`Iframe loaded for task run ${taskRunId}`);
    },
    onError: (error) => {
      console.error(`Failed to load iframe for task run ${taskRunId}:`, error);
    },
  });

  return (
    <div className="flex flex-row grow min-h-0">
      <div ref={containerRef} className="grow flex relative" />
    </div>
  );
}
