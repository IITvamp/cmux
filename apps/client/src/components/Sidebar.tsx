import { TaskTree } from "@/components/TaskTree";
import { TaskTreeSkeleton } from "@/components/TaskTreeSkeleton";
import { isElectron } from "@/lib/electron";
import { type Doc } from "@cmux/convex/dataModel";
import { Link } from "@tanstack/react-router";

interface SidebarProps {
  tasks: Doc<"tasks">[] | undefined;
  tasksWithRuns: (Doc<"tasks"> & { runs: any[] })[];
}

export function Sidebar({ tasks, tasksWithRuns }: SidebarProps) {
  return (
    <div className="w-64 bg-neutral-50 dark:bg-black flex flex-col shrink-0">
      <div
        className="h-[38px] flex items-center pl-3 pr-1.5"
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
        <div className="flex-1 overflow-y-auto px-3 py-1">
          <div className="flex items-center px-1 py-1">
            <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-500 uppercase tracking-[-0.005em] select-none">
              Recent Tasks
            </span>
          </div>
          <div className="space-y-0.5">
            {tasks === undefined ? (
              <TaskTreeSkeleton count={5} />
            ) : tasksWithRuns.length > 0 ? (
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

      <div className="pb-2">
        <a
          href="https://github.com/manaflow-ai/cmux/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center px-7 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors select-none cursor-default"
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
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Report an issue
        </a>
        <Link
          to="/settings"
          className="flex items-center px-7 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors select-none cursor-default"
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
  );
}
