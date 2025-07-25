import { api } from "@cmux/convex/api";
import { type Id } from "@cmux/convex/dataModel";
import { getShortId } from "@cmux/shared";
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import "@xterm/xterm/css/xterm.css";
import { usePersistentIframe } from "../hooks/usePersistentIframe";

// Configuration: Set to true to use the proxy URL, false to use direct localhost URL
const USE_PROXY_URL = false;

export const Route = createFileRoute("/_layout/task/$taskId/run/$taskRunId")({
  component: TaskRunComponent,
  loader: async (opts) => {
    opts.context.queryClient.ensureQueryData(
      convexQuery(api.taskRuns.get, {
        id: opts.params.taskRunId as Id<"taskRuns">,
      })
    );
    // void preloadTaskRunIframes([opts.params.taskRunId]);
  },
});

function TaskRunComponent() {
  const { taskRunId } = Route.useParams();
  const taskRun = useSuspenseQuery(
    convexQuery(api.taskRuns.get, {
      id: taskRunId as Id<"taskRuns">,
    })
  );

  const shortId = getShortId(taskRunId);

  let iframeUrl = USE_PROXY_URL
    ? `http://${shortId}.39378.localhost:9776/?folder=/root/workspace`
    : taskRun?.data?.vscode?.workspaceUrl || "about:blank";
  console.log(
    "taskRun?.data?.vscode?.workspaceUrl",
    taskRun?.data?.vscode?.workspaceUrl
  );

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
