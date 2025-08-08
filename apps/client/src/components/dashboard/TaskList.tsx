import type { Doc } from "@cmux/convex/dataModel";
import { memo, useMemo, useState } from "react";
import { TaskItem } from "./TaskItem";

interface TaskListProps {
  activeTasks: Doc<"tasks">[];
  archivedTasks: Doc<"tasks">[];
}

export const TaskList = memo(function TaskList({
  activeTasks,
  archivedTasks,
}: TaskListProps) {
  const [tab, setTab] = useState<"all" | "archived">("all");
  const tasks = useMemo(
    () => (tab === "archived" ? archivedTasks : activeTasks),
    [tab, activeTasks, archivedTasks]
  );

  if (
    (tasks?.length || 0) === 0 &&
    (tab === "all" ? activeTasks.length === 0 : archivedTasks.length === 0)
  ) {
    return null;
  }

  return (
    <div className="mt-6">
      <div className="mb-3">
        <div className="flex items-end gap-2.5 select-none">
          <button
            className={
              "text-sm font-medium transition-colors " +
              (tab === "all"
                ? "text-neutral-900 dark:text-neutral-100"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200")
            }
            onClick={() => setTab("all")}
          >
            Tasks
          </button>
          <button
            className={
              "text-sm font-medium transition-colors " +
              (tab === "archived"
                ? "text-neutral-900 dark:text-neutral-100"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200")
            }
            onClick={() => setTab("archived")}
          >
            Archived
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {tasks.map((task) => (
          <TaskItem key={task._id} task={task} />
        ))}
      </div>
    </div>
  );
});
