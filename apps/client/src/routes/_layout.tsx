import { TaskTree } from "@/components/TaskTree";
import { isElectron } from "@/lib/electron";
import { type TaskWithRuns } from "@/types/task";
import { api } from "@cmux/convex/api";
import { type Doc } from "@cmux/convex/dataModel";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQueries, useQuery } from "convex/react";
import { Suspense, useMemo } from "react";

export const Route = createFileRoute("/_layout")({
  component: LayoutComponent,
});

function LayoutComponent() {
  const tasks = useQuery(api.tasks.get, {});

  // Sort tasks by creation date (newest first) and take the latest 5
  const recentTasks = useMemo(() => {
    return (
      tasks
        ?.filter((task: Doc<"tasks">) => task.createdAt)
        ?.sort(
          (a: Doc<"tasks">, b: Doc<"tasks">) =>
            (b.createdAt || 0) - (a.createdAt || 0)
        ) || []
    );
  }, [tasks]);

  // Create queries object for all recent tasks with memoization
  const taskRunQueries = useMemo(() => {
    return recentTasks.reduce(
      (acc, task) => ({
        ...acc,
        [task._id]: {
          query: api.taskRuns.getByTask,
          args: { taskId: task._id },
        },
      }),
      {} as Record<
        string,
        { query: typeof api.taskRuns.getByTask; args: { taskId: string } }
      >
    );
  }, [recentTasks]);

  // Fetch task runs for all recent tasks using useQueries
  const taskRunResults = useQueries(taskRunQueries);

  // Map tasks with their respective runs
  const tasksWithRuns: TaskWithRuns[] = useMemo(
    () =>
      recentTasks.map((task: Doc<"tasks">) => ({
        ...task,
        runs: taskRunResults[task._id] || [],
      })),
    [recentTasks, taskRunResults]
  );

  return (
    <>
      <div className="flex flex-row grow bg-white dark:bg-black">
        <div className="w-64 bg-neutral-50 dark:bg-black flex flex-col">
          <div
            className="h-[38px] flex items-center pl-3 pr-3"
            style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          >
            {isElectron && <div className="w-[68px]"></div>}
            <Link
              to="/dashboard"
              className="w-[50px] h-[25px] bg-[#7d2fc7] hover:bg-[#7d2fc7]/80 transition text-white flex items-center justify-center font-medium rounded-lg text-xs select-none cursor-default"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
              cmux
            </Link>
            <div className="grow"></div>
            <Link
              to="/dashboard"
              className="w-[25px] h-[25px] bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 rounded-lg flex items-center justify-center transition-colors cursor-default"
              title="New task"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
              <svg
                className="w-4 h-4 text-neutral-600 dark:text-neutral-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </Link>
          </div>
          <nav className="flex-1 flex flex-col overflow-hidden">
            {/* Recent Tasks Section */}
            <div className="flex-1 overflow-y-auto px-3 py-1">
              <div className="flex items-center px-1 py-1">
                <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-500 uppercase tracking-[-0.005em] select-none">
                  Recent Tasks
                </span>
              </div>
              <div className="space-y-0.5">
                {tasksWithRuns.length > 0 ? (
                  tasksWithRuns
                    .slice(0, 10)
                    .map((task) => <TaskTree key={task._id} task={task} />)
                ) : (
                  <p className="px-2 py-1.5 text-xs text-center text-neutral-500 dark:text-neutral-400 select-none">
                    No recent tasks
                  </p>
                )}
              </div>
            </div>
          </nav>

          <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
            <Link
              to="/settings"
              className="flex items-center px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors select-none cursor-default"
            >
              <svg
                className="w-4 h-4 mr-3 text-neutral-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
              </svg>
              Settings
            </Link>
          </div>
        </div>

        {/* <div className="flex flex-col grow overflow-hidden bg-white dark:bg-neutral-950"> */}
        <Suspense fallback={<div>Loading...</div>}>
          <Outlet />
        </Suspense>
        {/* </div> */}
      </div>

      <button
        onClick={() => {
          const msg = window.prompt("Enter debug note");
          if (msg) {
            // Prefix allows us to easily grep in the console.

            console.log(`[USER NOTE] ${msg}`);
          }
        }}
        className="hidden"
        style={{
          position: "fixed",
          bottom: "16px",
          right: "16px",
          zIndex: 9999,
          background: "#ffbf00",
          color: "#000",
          border: "none",
          borderRadius: "4px",
          padding: "8px 12px",
          cursor: "default",
          fontSize: "12px",
          fontWeight: 600,
          boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
        }}
      >
        Add Debug Note
      </button>
    </>
  );
}
