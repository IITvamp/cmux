import { LogsPage } from "@/components/logging/LogsPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/logs")({
  component: LogsPage,
});
