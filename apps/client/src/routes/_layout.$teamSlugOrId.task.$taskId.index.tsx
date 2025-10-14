import { BrainstormPanel } from "@/components/brainstorm/BrainstormPanel";
import { FloatingPane } from "@/components/floating-pane";
import { TaskTimeline } from "@/components/task-timeline";
import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/$teamSlugOrId/task/$taskId/")({
  component: TaskDetailPage,
  validateSearch: (search: Record<string, unknown>) => {
    const runId = typedZid("taskRuns").optional().parse(search.runId);
    return {
      runId,
    };
  },
  loader: async (opts) => {
    const { taskId: rawTaskId, teamSlugOrId } = opts.params as {
      taskId: string;
      teamSlugOrId: string;
    };
    const taskId = typedZid("tasks").parse(rawTaskId);
    await Promise.all([
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.taskRuns.getByTask, {
          teamSlugOrId,
          taskId,
        })
      ),
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.tasks.getById, {
          teamSlugOrId,
          id: taskId,
        })
      ),
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.taskBrainstorms.getByTask, {
          teamSlugOrId,
          taskId,
        })
      ),
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.crown.getCrownEvaluation, {
          teamSlugOrId,
          taskId,
        })
      ),
    ]);
  },
});

function TaskDetailPage() {
  const { taskId: rawTaskId, teamSlugOrId } = Route.useParams() as {
    taskId: string;
    teamSlugOrId: string;
  };
  const taskId = typedZid("tasks").parse(rawTaskId);

  const task = useSuspenseQuery(
    convexQuery(api.tasks.getById, {
      teamSlugOrId,
      id: taskId,
    })
  );
  const taskRuns = useSuspenseQuery(
    convexQuery(api.taskRuns.getByTask, {
      teamSlugOrId,
      taskId,
    })
  );
  const crownEvaluation = useSuspenseQuery(
    convexQuery(api.crown.getCrownEvaluation, {
      teamSlugOrId,
      taskId,
    })
  );

  return (
    <FloatingPane>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl px-6 py-8">
            <div className="space-y-8">
              <BrainstormPanel teamSlugOrId={teamSlugOrId} taskId={taskId} />
              <TaskTimeline
                task={task.data}
                taskRuns={taskRuns.data}
                crownEvaluation={crownEvaluation.data}
              />
            </div>
          </div>
        </div>
      </div>
    </FloatingPane>
  );
}
