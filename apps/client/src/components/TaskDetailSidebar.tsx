import { api } from "@cmux/convex/api";
import type { Doc } from "@cmux/convex/dataModel";
import { useQuery } from "convex/react";
import { Crown } from "lucide-react";
import { CodeReviewPanel } from "./CodeReviewPanel";

interface TaskDetailSidebarProps {
  task: Doc<"tasks">;
  taskRuns: Doc<"taskRuns">[];
}

export function TaskDetailSidebar({ task, taskRuns }: TaskDetailSidebarProps) {
  // TODO: Uncomment when Convex is running and codeReviews API is generated
  // const codeReview = useQuery(api.codeReviews.getByTaskId, { taskId: task._id });
  const codeReview = null;
  const completedRuns = taskRuns.filter(run => run.status === "completed");
  const crownedRun = taskRuns.find(run => run.isCrowned);

  return (
    <div className="w-80 border-l border-neutral-200 dark:border-neutral-800 p-4 overflow-y-auto">
      <div className="space-y-4">
        {/* Task Info */}
        <div>
          <h3 className="text-sm font-medium mb-2">Task Details</h3>
          <div className="text-sm text-neutral-600 dark:text-neutral-400 space-y-1">
            <div>Status: {task.isCompleted ? "Completed" : "In Progress"}</div>
            <div>Created: {new Date(task.createdAt || 0).toLocaleString()}</div>
            {task.projectFullName && <div>Project: {task.projectFullName}</div>}
            {task.branch && <div>Branch: {task.branch}</div>}
          </div>
        </div>

        {/* Run Summary */}
        <div>
          <h3 className="text-sm font-medium mb-2">Run Summary</h3>
          <div className="text-sm text-neutral-600 dark:text-neutral-400 space-y-1">
            <div>Total runs: {taskRuns.length}</div>
            <div>Completed: {completedRuns.length}</div>
            {crownedRun && (
              <div className="flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                <span>Winner: Run {taskRuns.findIndex(r => r._id === crownedRun._id) + 1}</span>
              </div>
            )}
          </div>
        </div>

        {/* Code Review Panel */}
        <CodeReviewPanel task={task} taskRuns={taskRuns} />
      </div>
    </div>
  );
}