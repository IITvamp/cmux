import { type Doc } from "@cmux/convex/dataModel";

export interface TaskRunWithChildren extends Doc<"taskRuns"> {
  children: TaskRunWithChildren[];
}

export interface TaskWithRuns extends Doc<"tasks"> {
  runs: TaskRunWithChildren[];
}

export interface Repo {
  fullName: string;
  org: string;
  name: string;
}

export interface TaskVersion extends Doc<"taskVersions"> {
  task: Doc<"tasks">;
  version: number;
}

export type RunEnvironmentSummary = Pick<
  Doc<"environments">,
  "_id" | "name" | "selectedRepos"
>;
