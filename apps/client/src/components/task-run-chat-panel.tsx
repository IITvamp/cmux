import { TaskTimeline } from "@/components/task-timeline";
import type { Doc, Id } from "@cmux/convex/dataModel";

type TaskRunWithChildren = Doc<"taskRuns"> & {
  children?: TaskRunWithChildren[];
};

interface TaskRunChatPanelProps {
  task?: Doc<"tasks"> | null;
  taskRuns?: TaskRunWithChildren[] | null;
  crownEvaluation?: {
    evaluatedAt?: number;
    winnerRunId?: Id<"taskRuns">;
    reason?: string;
  } | null;
}

export function TaskRunChatPanel({
  task,
  taskRuns,
  crownEvaluation,
}: TaskRunChatPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto bg-neutral-50 dark:bg-neutral-950">
      <div className="max-w-3xl mx-auto px-4 py-4 sm:px-6">
        <TaskTimeline
          task={task ?? null}
          taskRuns={taskRuns ?? null}
          crownEvaluation={crownEvaluation ?? null}
        />
      </div>
    </div>
  );
}
