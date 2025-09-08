import { FloatingPane } from "#/components/floating-pane";
import { TaskTimeline } from "#/components/task-timeline";
import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import z from "zod";

const paramsSchema = z.object({
  taskId: typedZid("tasks"),
});

export const Route = createFileRoute("/_layout/$teamSlugOrId/task/$taskId/")({
  component: TaskDetailPage,
  params: {
    parse: paramsSchema.parse,
    stringify: (params) => {
      return {
        taskId: params.taskId,
      };
    },
  },
  validateSearch: (search: Record<string, unknown>) => {
    const runId = typedZid("taskRuns").optional().parse(search.runId);
    return {
      runId: runId,
    };
  },
  loader: async (opts) => {
    await Promise.all([
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.taskRuns.getByTask, {
          teamSlugOrId: opts.params.teamSlugOrId,
          taskId: opts.params.taskId,
        })
      ),
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.tasks.getById, {
          teamSlugOrId: opts.params.teamSlugOrId,
          id: opts.params.taskId,
        })
      ),
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.crown.getCrownEvaluation, {
          teamSlugOrId: opts.params.teamSlugOrId,
          taskId: opts.params.taskId,
        })
      ),
    ]);
  },
});

function TaskDetailPage() {
  const { taskId, teamSlugOrId } = Route.useParams();

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
          <div className="max-w-3xl mx-auto px-6 py-8">
            <div>
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
