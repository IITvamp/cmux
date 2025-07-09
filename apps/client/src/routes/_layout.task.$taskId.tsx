import { api } from "@coderouter/convex/api";
import { type Id } from "@coderouter/convex/dataModel";
import {
  createFileRoute,
  Link,
  Outlet,
  useChildMatches,
  useNavigate,
} from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useEffect } from "react";

export const Route = createFileRoute("/_layout/task/$taskId")({
  component: TaskDetailPage,
});

// type TaskRunWithChildren = DataModel["taskRuns"] & { children: TaskRunWithChildren[] };
type GetByTaskResultItem = (typeof api.taskRuns.getByTask._returnType)[number];

function TaskDetailPage() {
  const { taskId } = Route.useParams();
  const task = useQuery(api.tasks.getById, { id: taskId as Id<"tasks"> });
  const taskRuns = useQuery(api.taskRuns.getByTask, {
    taskId: taskId as Id<"tasks">,
  });

  // Get the deepest matched child to extract runId if present
  const childMatches = useChildMatches();
  const deepestMatch = childMatches[childMatches.length - 1];
  const deepestMatchParams = deepestMatch?.params as
    | { runId: string }
    | undefined;
  const activeRunId = deepestMatchParams?.runId as string | undefined;

  const navigate = useNavigate();

  // Flatten the task runs tree structure for tab display
  const flattenRuns = (
    runs: GetByTaskResultItem[]
  ): Array<GetByTaskResultItem & { depth: number }> => {
    const result: Array<GetByTaskResultItem & { depth: number }> = [];
    const traverse = (run: GetByTaskResultItem, depth: number = 0) => {
      result.push({ ...run, depth });
      if (run.children) {
        run.children.forEach((child: GetByTaskResultItem) =>
          traverse(child, depth + 1)
        );
      }
    };
    runs?.forEach((run) => traverse(run));
    return result;
  };
  console.log("task", taskRuns);

  const flatRuns = flattenRuns(taskRuns || []);

  // If no runId is in the URL yet, automatically navigate to the first one so
  // that the details pane shows something useful.
  useEffect(() => {
    if (flatRuns.length > 0 && !activeRunId) {
      navigate({
        to: "/task/$taskId/run/$runId",
        params: { taskId, runId: flatRuns[0]._id },
        replace: true,
      });
    }
  }, [flatRuns, activeRunId, taskId, navigate]);

  if (!task || !taskRuns) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-neutral-200 dark:border-neutral-700 px-6 py-4">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          {task.text}
        </h1>
        {task.description && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {task.description}
          </p>
        )}
      </div>

      {flatRuns.length > 0 && (
        <div className="border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex overflow-x-auto">
            {flatRuns.map((run, index) => (
              <Link
                key={run._id}
                to="/task/$taskId/run/$runId"
                params={{ taskId, runId: run._id }}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeRunId === run._id
                    ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                    : "text-neutral-600 dark:text-neutral-400 border-transparent hover:text-neutral-900 dark:hover:text-neutral-100"
                }`}
                // No onClick needed; active class controlled by URL
              >
                <span style={{ paddingLeft: `${run.depth * 12}px` }}>
                  Run {index + 1}
                  {run.status === "running" && " 🟢"}
                  {run.status === "completed" && " ✅"}
                  {run.status === "failed" && " ❌"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
