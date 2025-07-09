import { TaskTree } from "@/components/TaskTree";
import { TitleBar } from "@/components/TitleBar";
import { type TaskWithRuns } from "@/types/task";
import { api } from "@coderouter/convex/api";
import { type Doc } from "@coderouter/convex/dataModel";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "convex/react";

export const Route = createFileRoute("/_layout")({
  component: LayoutComponent,
});

function LayoutComponent() {
  const tasks = useQuery(api.tasks.get, {});

  // Sort tasks by creation date (newest first) and take the latest 5
  const recentTasks =
    tasks
      ?.filter((task: Doc<"tasks">) => task.createdAt)
      ?.sort(
        (a: Doc<"tasks">, b: Doc<"tasks">) =>
          (b.createdAt || 0) - (a.createdAt || 0)
      )
      ?.slice(0, 5) || [];

  // Fetch task runs for each task
  const taskRuns = useQuery(
    api.taskRuns.getByTask,
    recentTasks.length > 0 ? { taskId: recentTasks[0]._id } : "skip"
  );

  // For now, we'll fetch runs for the first task only to avoid too many queries
  // In a real app, you might want to batch these or fetch on-demand
  const tasksWithRuns: TaskWithRuns[] = recentTasks.map(
    (task: Doc<"tasks">, index: number) => ({
      ...task,
      runs: index === 0 ? taskRuns : undefined,
    })
  );

  return (
    <>
      <div className="flex h-full bg-neutral-50 dark:bg-neutral-900">
        {/* Left Sidebar */}
        <div className="w-[240px] bg-neutral-50 dark:bg-neutral-900 flex flex-col">
          {/* Logo/Brand */}
          {/* <div className="h-14 flex items-center px-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg"></div>
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
              Workspace
            </span>
          </div>
        </div> */}
          <div
            className="h-[38px] flex items-center"
            style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          >
            <div className="w-[80px]"></div>
            <button
              className="w-[100px] h-[25px] bg-primary/80 hover:bg-primary transition text-white flex items-center justify-center font-medium rounded-lg text-xs select-none invisible"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
              Workspace 1
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            <Link
              to="/dashboard"
              className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors [&.active]:bg-neutral-100 dark:[&.active]:bg-neutral-800 [&.active]:text-neutral-900 dark:[&.active]:text-neutral-100 select-none"
            >
              <svg
                className="w-5 h-5 mr-3 text-neutral-400 dark:text-neutral-500"
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
              New task
            </Link>

            {/* Temporarily comment out routes that don't exist yet
          <Link
            to="/inbox"
            className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors [&.active]:bg-neutral-100 dark:[&.active]:bg-neutral-800 [&.active]:text-neutral-900 dark:[&.active]:text-neutral-100"
          >
            <svg
              className="w-5 h-5 mr-3 text-neutral-400 dark:text-neutral-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            Inbox
          </Link>

          <Link
            to="/issues"
            className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors [&.active]:bg-neutral-100 dark:[&.active]:bg-neutral-800 [&.active]:text-neutral-900 dark:[&.active]:text-neutral-100"
          >
            <svg
              className="w-5 h-5 mr-3 text-neutral-400 dark:text-neutral-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Issues
          </Link>

          <Link
            to="/projects"
            className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors [&.active]:bg-neutral-100 dark:[&.active]:bg-neutral-800 [&.active]:text-neutral-900 dark:[&.active]:text-neutral-100"
          >
            <svg
              className="w-5 h-5 mr-3 text-neutral-400 dark:text-neutral-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            Projects
          </Link>
          */}

            <div className="pt-6">
              <p className="px-3 text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide select-none">
                Recent Tasks
              </p>
              <div className="mt-1 space-y-0.5">
                {tasksWithRuns.length > 0 ? (
                  tasksWithRuns.map((task: TaskWithRuns) => (
                    <TaskTree key={task._id} task={task} />
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400 select-none">
                    No recent tasks
                  </p>
                )}
              </div>
            </div>
          </nav>

          {/* Bottom section */}
          <div className="p-3 border-t border-neutral-200 dark:border-neutral-900">
            <Link
              to="/settings"
              className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors [&.active]:bg-neutral-100 dark:[&.active]:bg-neutral-800 [&.active]:text-neutral-900 dark:[&.active]:text-neutral-100 select-none"
            >
              <svg
                className="w-5 h-5 mr-3 text-neutral-400 dark:text-neutral-500"
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Settings
            </Link>
          </div>
        </div>

        {/* Main Content Area - Floating Panel Effect */}
        <div className="flex-1 flex flex-col overflow-hidden p-1.5">
          <main className="flex flex-col overflow-hidden flex-1 bg-white dark:bg-neutral-800 rounded-md border border-neutral-200 dark:border-neutral-800/80">
            <TitleBar />
            <div className="flex-1 overflow-y-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* Debug helper – fixed position note button */}
      <button
        onClick={() => {
          const msg = window.prompt("Enter debug note");
          if (msg) {
            // Prefix allows us to easily grep in the console.

            console.log(`[USER NOTE] ${msg}`);
          }
        }}
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
          cursor: "pointer",
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
