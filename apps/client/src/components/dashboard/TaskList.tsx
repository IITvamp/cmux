import type { Doc } from "@cmux/convex/dataModel";
import { memo, useMemo, useState } from "react";
import { TaskItem } from "./TaskItem";

interface TaskListProps {
  activeTasks: Doc<"tasks">[];
  archivedTasks: Doc<"tasks">[];
}

export const TaskList = memo(function TaskList({ activeTasks, archivedTasks }: TaskListProps) {
  const [tab, setTab] = useState<"all" | "archived">("all");
  const tasks = useMemo(() => (tab === "archived" ? archivedTasks : activeTasks), [tab, activeTasks, archivedTasks]);

  if ((tasks?.length || 0) === 0 && (tab === "all" ? activeTasks.length === 0 : archivedTasks.length === 0)) {
    return null;
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 select-none">
          {tab === "archived" ? "Archived Tasks" : "All Tasks"}
        </h2>
        <div className="inline-flex rounded-md overflow-hidden border border-neutral-200 dark:border-neutral-600">
          <button
            className={
              "px-2.5 py-1 text-xs select-none cursor-default transition " +
              (tab === "all"
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black"
                : "bg-white dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-600")
            }
            onClick={() => setTab("all")}
          >
            All
          </button>
          <button
            className={
              "px-2.5 py-1 text-xs select-none cursor-default transition " +
              (tab === "archived"
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black"
                : "bg-white dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-600")
            }
            onClick={() => setTab("archived")}
          >
            Archived
          </button>
        </div>
      </div>
      <div className="space-y-1">
        {tasks.map((task) => (
          <TaskItem key={task._id} task={task} />
        ))}
      </div>
    </div>
  );
});
