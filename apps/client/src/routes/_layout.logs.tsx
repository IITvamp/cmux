import { ElectronLogsPage } from "@/components/electron-logs/ElectronLogsPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/logs")({
  component: LogsRoute,
});

function LogsRoute() {
  return <ElectronLogsPage />;
}
