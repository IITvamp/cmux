import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex-gen/api";
import { type Id } from "convex/_generated/dataModel";
import { useQuery } from "convex/react";

export const Route = createFileRoute("/_layout/task/$taskId/run/$runId")({
  component: TaskRunComponent,
});

function TaskRunComponent() {
  const { runId } = Route.useParams();
  // Subscribe so that log updates stream in real-time.
  const taskRun = useQuery(api.taskRuns.subscribe, {
    id: runId as Id<"taskRuns">,
  });

  if (!taskRun) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-neutral-200 dark:border-neutral-700 px-6 py-4">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Task Run Details
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Status: {taskRun.status}
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="flex flex-col h-full space-y-6">
          <div>
            <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Prompt
            </h2>
            <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4">
              <pre className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                {taskRun.prompt}
              </pre>
            </div>
          </div>

          {taskRun.summary && (
            <div>
              <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Summary
              </h2>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {taskRun.summary}
              </div>
            </div>
          )}

          <div className="flex flex-col flex-1">
            <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Terminal Output
            </h2>
            <div className="flex-1 min-h-0">
              {/* <TerminalComponent
                taskRunId={runId}
                initialContent={taskRun.log || ""}
              /> */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
