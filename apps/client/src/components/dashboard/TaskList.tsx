import type { Doc } from "@cmux/convex/dataModel";
import { memo } from "react";
import { TaskItem } from "./TaskItem";

interface TaskListProps {
  tasks: Doc<"tasks">[];
}

export const TaskList = memo(function TaskList({ tasks }: TaskListProps) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2 select-none">
        All Tasks
      </h2>
      <div className="space-y-1">
        {tasks.map((task) => (
          <TaskItem key={task._id} task={task} />
        ))}
      </div>
    </div>
  );
});