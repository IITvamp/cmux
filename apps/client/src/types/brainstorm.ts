import type { Doc, Id } from "@cmux/convex/dataModel";

export type BrainstormDetails = Doc<"taskBrainstorms"> & {
  messages: Doc<"taskBrainstormMessages">[];
  subtasks: Array<
    Doc<"taskBrainstormSubtasks"> & {
      dependencyIds: Id<"taskBrainstormSubtasks">[];
    }
  >;
};

export type BrainstormSummary = {
  taskId: Id<"tasks">;
  brainstormId: Id<"taskBrainstorms">;
  status: Doc<"taskBrainstorms">["status"];
  updatedAt: number;
};

export const BRAINSTORM_STATUS_OPTIONS: Array<{
  value: Doc<"taskBrainstorms">["status"];
  label: string;
}> = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "complete", label: "Complete" },
];

export const SUBTASK_STATUS_OPTIONS: Array<{
  value: Doc<"taskBrainstormSubtasks">["status"];
  label: string;
}> = [
  { value: "planned", label: "Planned" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];

export type AuthorType = Doc<"taskBrainstormMessages">["authorType"];
