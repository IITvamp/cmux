import type { Doc } from "@cmux/convex/dataModel";

export interface TaskRunWithChildren extends Doc<"taskRuns"> {
  children: TaskRunWithChildren[];
}

export interface AnnotatedTaskRun extends TaskRunWithChildren {
  agentOrdinal?: number;
  hasDuplicateAgentName?: boolean;
  children: AnnotatedTaskRun[];
}

export interface TaskWithRuns extends Doc<"tasks"> {
  runs: TaskRunWithChildren[];
}
