import { type Doc } from "@coderouter/convex/dataModel";
import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle,
  ChevronRight,
  Circle,
  Loader2,
  XCircle,
} from "lucide-react";
import { useState } from "react";

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

export function TaskTree({ task, level = 0 }: TaskTreeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasRuns = task.runs && task.runs.length > 0;

  return (
    <div className="select-none flex flex-col gap-[1.5px]">
      <Link
        to="/task/$taskId"
        params={{ taskId: task._id }}
        className={clsx(
          "flex items-center px-2 py-1.5 text-sm rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-default",
          "[&.active]:bg-neutral-100 dark:[&.active]:bg-neutral-800"
        )}
        style={{ paddingLeft: `${8 + level * 16}px` }}
      >
        <button
          onClick={(e) => {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }}
          className={clsx(
            "w-4 h-4 mr-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors",
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
            "w-4 h-4 mr-2 rounded flex items-center justify-center flex-shrink-0",
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
          <p className="truncate text-neutral-700 dark:text-neutral-300">
            {task.text}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-500">
            {task.createdAt
              ? formatDistanceToNow(new Date(task.createdAt), {
                  addSuffix: true,
                })
              : "Recently"}
          </p>
        </div>
      </Link>

      {isExpanded && hasRuns && (
        <div className="flex flex-col gap-[1.5px]">
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

  const statusIcon = {
    pending: <Circle className="w-3 h-3 text-neutral-400" />,
    running: <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />,
    completed: <CheckCircle className="w-3 h-3 text-green-500" />,
    failed: <XCircle className="w-3 h-3 text-red-500" />,
  }[run.status];

  return (
    <div>
      <Link
        to="/task/$taskId/run/$runId"
        params={{ taskId, runId: run._id }}
        className={clsx(
          "flex items-center px-2 py-1 text-xs rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-default",
          "[&.active]:bg-neutral-100 dark:[&.active]:bg-neutral-800"
        )}
        style={{ paddingLeft: `${8 + level * 16}px` }}
      >
        <button
          onClick={(e) => {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }}
          className={clsx(
            "w-4 h-4 mr-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors",
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
          <p className="truncate text-neutral-600 dark:text-neutral-400">
            {(() => {
              // Extract agent name from prompt if it exists
              const agentMatch = run.prompt.match(/\(([^)]+)\)$/);
              const agentName = agentMatch ? agentMatch[1] : null;

              if (run.summary) {
                return run.summary;
              } else if (agentName) {
                return agentName;
              } else {
                return run.prompt.substring(0, 50) + "...";
              }
            })()}
          </p>
          <p className="text-[10px] text-neutral-500 dark:text-neutral-500">
            {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
          </p>
        </div>
      </Link>

      {isExpanded && hasChildren && (
        <div className="flex flex-col gap-px">
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
