import { api } from "@cmux/convex/api";
import { type Id } from "@cmux/convex/dataModel";
import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/task/$taskId/")({
  component: TaskDetailPage,
  loader: async (opts) => {
    await Promise.all([
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.taskRuns.getByTask, {
          taskId: opts.params.taskId as Id<"tasks">,
        })
      ),
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.tasks.getById, {
          id: opts.params.taskId as Id<"tasks">,
        })
      ),
    ]);
  },
});

function TaskDetailPage() {
  const { taskId } = Route.useParams();

  return (
    <div className="flex flex-col grow min-h-0 border-l border-neutral-200 dark:border-neutral-800">
      main page with git ui
    </div>
  );
}
