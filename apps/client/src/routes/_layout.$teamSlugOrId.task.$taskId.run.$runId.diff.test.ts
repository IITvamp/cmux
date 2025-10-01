import { describe, expect, it } from "vitest";

import { collectAgentNamesFromRuns } from "./_layout.$teamSlugOrId.task.$taskId.run.$runId.diff";

type TaskRunWithChildren = NonNullable<
  Parameters<typeof collectAgentNamesFromRuns>[0]
>[number];

const toTaskRunId = (id: string): TaskRunWithChildren["_id"] => 
  id as TaskRunWithChildren["_id"];

const baseTaskId: TaskRunWithChildren["taskId"] =
  "task" as TaskRunWithChildren["taskId"];

const baseUserId: TaskRunWithChildren["userId"] = "user";
const baseTeamId: TaskRunWithChildren["teamId"] = "team";

const createRun = (
  params: {
    id: string;
    createdAt: number;
    agentName?: string;
    children?: TaskRunWithChildren[];
  },
): TaskRunWithChildren => {
  const { id, createdAt, agentName, children = [] } = params;
  return {
    _id: toTaskRunId(id),
    taskId: baseTaskId,
    prompt: "Prompt",
    status: "completed",
    createdAt,
    updatedAt: createdAt,
    userId: baseUserId,
    teamId: baseTeamId,
    agentName,
    children,
    environment: null,
  } as TaskRunWithChildren;
};

describe("collectAgentNamesFromRuns", () => {
  it("preserves duplicate agent selections across root runs", () => {
    const agentName = "codex/gpt-5-high";
    const runs: TaskRunWithChildren[] = [
      createRun({ id: "run-1", createdAt: 1, agentName }),
      createRun({ id: "run-2", createdAt: 2, agentName }),
    ];

    expect(collectAgentNamesFromRuns(runs)).toEqual([agentName, agentName]);
  });

  it("falls back to child runs when a root run has no agent name", () => {
    const agentName = "claude/sonnet-4.5";
    const child = createRun({ id: "run-1-child", createdAt: 2, agentName });
    const runs: TaskRunWithChildren[] = [
      createRun({ id: "run-1", createdAt: 1, children: [child] }),
    ];

    expect(collectAgentNamesFromRuns(runs)).toEqual([agentName]);
  });

  it("ignores runs with unrecognised agent names", () => {
    const runs: TaskRunWithChildren[] = [
      createRun({ id: "run-1", createdAt: 1, agentName: "unknown-agent" }),
      createRun({ id: "run-2", createdAt: 2 }),
    ];

    expect(collectAgentNamesFromRuns(runs)).toEqual([]);
  });
});
