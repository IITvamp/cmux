import { __TEST_INTERNAL_ONLY_GET_STACK_TOKENS } from "@/lib/test-utils/__TEST_INTERNAL_ONLY_GET_STACK_TOKENS";
import { honoTestFetch } from "@/lib/utils/hono-test-fetch";
import { getConvex } from "@/lib/utils/get-convex";
import { api } from "@cmux/convex/api";
import { describe, expect, it } from "vitest";

describe("runsRouter integration", () => {
  it("resumes a run by returning a stable proxy workspace URL", async () => {
    const tokens = await __TEST_INTERNAL_ONLY_GET_STACK_TOKENS();
    const convex = getConvex({ accessToken: tokens.accessToken });

    // Create a task and a minimal run
    const taskId = await convex.mutation(api.tasks.create, {
      teamSlugOrId: "manaflow",
      text: "Test resume run",
      projectFullName: "manaflow-ai/cmux",
    });

    const { taskRunId } = await convex.mutation(api.taskRuns.create, {
      teamSlugOrId: "manaflow",
      taskId,
      prompt: "Test resume run",
      agentName: "test/agent",
    });

    const res = await honoTestFetch("/api/runs/resume", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-stack-auth": JSON.stringify(tokens),
      },
      body: JSON.stringify({ teamSlugOrId: "manaflow", runId: taskRunId }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { workspaceUrl: string };
    expect(data.workspaceUrl).toContain(`cmux-${taskRunId}.vscode.localhost`);
    expect(data.workspaceUrl).toContain("/root/workspace");
  });

  it("terminates a run (best-effort) and returns success", async () => {
    const tokens = await __TEST_INTERNAL_ONLY_GET_STACK_TOKENS();
    const convex = getConvex({ accessToken: tokens.accessToken });

    // Create a task and run again for termination test
    const taskId = await convex.mutation(api.tasks.create, {
      teamSlugOrId: "manaflow",
      text: "Test terminate run",
      projectFullName: "manaflow-ai/cmux",
    });

    const { taskRunId } = await convex.mutation(api.taskRuns.create, {
      teamSlugOrId: "manaflow",
      taskId,
      prompt: "Test terminate run",
      agentName: "test/agent",
    });

    const res = await honoTestFetch("/api/runs/terminate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-stack-auth": JSON.stringify(tokens),
      },
      body: JSON.stringify({ teamSlugOrId: "manaflow", runId: taskRunId }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { terminated: boolean };
    expect(data.terminated).toBe(true);
  });
});

