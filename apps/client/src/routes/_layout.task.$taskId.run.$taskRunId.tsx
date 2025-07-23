import { getShortId } from "@coderouter/shared";
import { createFileRoute } from "@tanstack/react-router";
import "@xterm/xterm/css/xterm.css";

export const Route = createFileRoute("/_layout/task/$taskId/run/$taskRunId")({
  component: TaskRunComponent,
});

function TaskRunComponent() {
  const { taskRunId } = Route.useParams();
  const shortId = getShortId(taskRunId);
  const iframeUrl = `http://${shortId}.39378.localhost:3001/?folder=/root/workspace`;

  return (
    <div className="flex flex-row grow min-h-0">
      <iframe src={iframeUrl} className="grow border-0"></iframe>
    </div>
  );
}
