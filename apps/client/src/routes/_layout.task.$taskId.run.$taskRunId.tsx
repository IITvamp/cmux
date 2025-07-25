import { preloadTaskRunIframes } from "@/lib/preloadTaskRunIframes";
import { api } from "@cmux/convex/api";
import { type Id } from "@cmux/convex/dataModel";
import { getShortId } from "@cmux/shared";
import { createFileRoute } from "@tanstack/react-router";
import "@xterm/xterm/css/xterm.css";
import { useQuery } from "convex/react";
import { usePersistentIframe } from "../hooks/usePersistentIframe";

// Configuration: Set to true to use the proxy URL, false to use direct localhost URL
const USE_PROXY_URL = false;

export const Route = createFileRoute("/_layout/task/$taskId/run/$taskRunId")({
  component: TaskRunComponent,
  loader: async (opts) => {
    void preloadTaskRunIframes([opts.params.taskRunId]);
  },
});

function TaskRunComponent() {
  const { taskRunId } = Route.useParams();
  const taskRun = useQuery(api.taskRuns.get, {
    id: taskRunId as Id<"taskRuns">,
  });
  console.log("taskRun", taskRun);

  const shortId = getShortId(taskRunId);

  let iframeUrl: string;

  if (USE_PROXY_URL) {
    // Use the proxy URL pattern
    iframeUrl = `http://${shortId}.39378.localhost:9776/?folder=/root/workspace`;
  } else {
    // Use the actual Docker URL from the database if available
    if (taskRun?.vscode?.workspaceUrl) {
      iframeUrl = taskRun.vscode.workspaceUrl;
    } else if (taskRun?.vscode?.url) {
      iframeUrl = `${taskRun.vscode.url}/?folder=/root/workspace`;
    } else {
      // Fallback to proxy URL if no database URL is available
      iframeUrl = `http://${shortId}.39378.localhost:9776/?folder=/root/workspace`;
    }
  }

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
