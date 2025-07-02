import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/task/$taskId")({
  component: TaskDetailPage,
});

function TaskDetailPage() {
  return <div>lol</div>;
}
