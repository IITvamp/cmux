import { type Doc } from "@cmux/convex/dataModel";
import { Link, useLocation } from "@tanstack/react-router";
import clsx from "clsx";
import {
  CheckCircle,
  ChevronRight,
  Circle,
  Loader2,
  XCircle,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

interface TaskRunWithChildren extends Doc<"taskRuns"> {
  children: TaskRunWithChildren[];
}

interface TaskWithRuns extends Doc<"tasks"> {
  runs: TaskRunWithChildren[];
}

interface TaskTreeProps {
  task: TaskWithRuns;
  level?: number;
}

// Extract the display text logic to avoid re-creating it on every render
function getRunDisplayText(run: TaskRunWithChildren): string {
  if (run.summary) {
    return run.summary;
  }

  // Extract agent name from prompt if it exists
  const agentMatch = run.prompt.match(/\(([^)]+)\)$/);
  const agentName = agentMatch ? agentMatch[1] : null;

  if (agentName) {
    return agentName;
  }

  return run.prompt.substring(0, 50) + "...";
}

export function TaskTree({ task, level = 0 }: TaskTreeProps) {
  // Get the current route to determine if this task is selected
  const location = useLocation();
  const isTaskSelected = useMemo(
    () => location.pathname.includes(`/task/${task._id}`),
    [location.pathname, task._id]
  );

  // Default to collapsed unless this task is selected
  const [isExpanded, setIsExpanded] = useState(isTaskSelected);
  const hasRuns = task.runs && task.runs.length > 0;

  // Memoize the toggle handler
  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <div className="select-none flex flex-col">
      <Link
        to="/task/$taskId"
        params={{ taskId: task._id }}
        className={clsx(
          "flex items-center px-2 py-1.5 text-sm rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-default",
          "[&.active]:bg-neutral-100 dark:[&.active]:bg-neutral-800"
        )}
        style={{ paddingLeft: `${8 + level * 16}px` }}
      >
        <button
          onClick={handleToggle}
          className={clsx(
            "w-4 h-4 mr-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors grid place-content-center cursor-default",
            !hasRuns && "invisible"
          )}
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <ChevronRight
            className={clsx(
              "w-3 h-3 transition-transform",
              isExpanded && "rotate-90"
            )}
          />
        </button>

        <div
          className={clsx(
            "w-4 h-4 mr-2 rounded-full flex items-center justify-center flex-shrink-0",
            task.isCompleted
              ? "bg-green-100 dark:bg-green-900/30"
              : "bg-blue-100 dark:bg-blue-900/30"
          )}
        >
          <span
            className={clsx(
              "text-[10px] font-medium",
              task.isCompleted
                ? "text-green-600 dark:text-green-400"
                : "text-blue-600 dark:text-blue-400"
            )}
          >
            {task.text.substring(0, 1).toUpperCase()}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="truncate text-neutral-900 dark:text-neutral-100 font-medium">
            {task.text}
          </p>
        </div>
      </Link>

      {isExpanded && hasRuns && (
        <div className="flex flex-col">
          {task.runs.map((run) => (
            <TaskRunTree
              key={run._id}
              run={run}
              level={level + 1}
              taskId={task._id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TaskRunTreeProps {
  run: TaskRunWithChildren;
  level: number;
  taskId: string;
}

function TaskRunTree({ run, level, taskId }: TaskRunTreeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = run.children.length > 0;

  // Memoize the display text to avoid recalculating on every render
  const displayText = useMemo(() => getRunDisplayText(run), [run]);

  // Memoize the toggle handler
  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsExpanded((prev) => !prev);
  }, []);

  const statusIcon = {
    pending: <Circle className="w-3 h-3 text-neutral-400" />,
    running: <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />,
    completed: <CheckCircle className="w-3 h-3 text-green-500" />,
    failed: <XCircle className="w-3 h-3 text-red-500" />,
  }[run.status];

  return (
    <div>
      <Link
        to="/task/$taskId/run/$taskRunId"
        params={{ taskId, taskRunId: run._id }}
        className={clsx(
          "flex items-center px-2 py-1 text-xs rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-default",
          "[&.active]:bg-neutral-100 dark:[&.active]:bg-neutral-800"
        )}
        style={{ paddingLeft: `${8 + level * 16}px` }}
      >
        <button
          onClick={handleToggle}
          className={clsx(
            "w-4 h-4 mr-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors cursor-default",
            !hasChildren && "invisible"
          )}
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <ChevronRight
            className={clsx(
              "w-3 h-3 transition-transform",
              isExpanded && "rotate-90"
            )}
          />
        </button>

        <div className="mr-2 flex-shrink-0">{statusIcon}</div>

        <div className="flex-1 min-w-0">
          <p className="truncate text-neutral-700 dark:text-neutral-300">
            {displayText}
          </p>
        </div>
      </Link>

      {isExpanded && hasChildren && (
        <div className="flex flex-col">
          {run.children.map((childRun) => (
            <TaskRunTree
              key={childRun._id}
              run={childRun}
              level={level + 1}
              taskId={taskId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
