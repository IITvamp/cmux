import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { jwtVerify } from "jose";
import { z } from "zod";
import { env } from "../_shared/convex-env";

const JSON_HEADERS = { "content-type": "application/json" } as const;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// Verify task run token issued at taskRuns.create
async function verifyTaskRunToken(token: string): Promise<{
  taskRunId: string;
  teamId: string;
  userId: string;
}> {
  const secret = new TextEncoder().encode(env.CMUX_TASK_RUN_JWT_SECRET);
  const verification = await jwtVerify(token, secret);
  const Schema = z.object({ taskRunId: z.string(), teamId: z.string(), userId: z.string() });
  const parsed = Schema.safeParse(verification.payload);
  if (!parsed.success) throw new Error("Invalid task run token payload");
  return parsed.data;
}

const CompleteAndCheckSchema = z.object({
  taskRunId: z.string(),
  exitCode: z.number().optional(),
});

export const completeAndCheck = httpAction(async (ctx, req) => {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonResponse({ code: 415, message: "Content-Type must be application/json" }, 415);
  }

  const token = req.headers.get("x-cmux-token");
  if (!token) return jsonResponse({ code: 401, message: "Missing x-cmux-token" }, 401);

  let auth;
  try {
    auth = await verifyTaskRunToken(token);
  } catch (e) {
    return jsonResponse({ code: 401, message: "Invalid CMUX token" }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ code: 400, message: "Invalid JSON body" }, 400);
  }

  const parsed = CompleteAndCheckSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ code: 400, message: "Invalid input" }, 400);
  }

  const { taskRunId, exitCode } = parsed.data;
  if (taskRunId !== auth.taskRunId) {
    return jsonResponse({ code: 403, message: "Token does not match taskRunId" }, 403);
  }

  // Retry helper with simple backoff
  async function retry<T>(fn: () => Promise<T>, retries = 5, baseDelayMs = 50): Promise<T> {
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        return await fn();
      } catch (err) {
        if (attempt >= retries) throw err;
        const delay = Math.min(1000, baseDelayMs * Math.pow(2, attempt));
        const jitter = Math.random() * 0.3 * delay;
        await new Promise((r) => setTimeout(r, delay + jitter));
        attempt++;
      }
    }
  }

  // 1) Mark the task run as completed (idempotent)
  await retry(() =>
    ctx.runMutation(api.taskRuns.updateStatus, {
      id: auth.taskRunId as Id<"taskRuns">,
      status: "completed",
      exitCode: exitCode ?? 0,
    })
  );

  // 2) Fetch the taskRun and all runs for the task
  const run = await ctx.runQuery(api.taskRuns.getById, {
    id: auth.taskRunId as Id<"taskRuns">,
  });
  if (!run) {
    return jsonResponse({ code: 404, message: "Task run not found" }, 404);
  }

  const runs = await ctx.runQuery(api.taskRuns.listByTaskForTeam, {
    taskId: run.taskId,
    teamId: auth.teamId,
    userId: auth.userId,
  });

  const allCompleted = runs.every((r) => r.status === "completed" || r.status === "failed");
  if (!allCompleted) {
    return jsonResponse({ status: "incomplete" });
  }

  // 3) Mark the parent task as completed (idempotent)
  await retry(() => ctx.runMutation(api.tasks.setCompletedInternal, { id: run.taskId, isCompleted: true }));

  // 4) If only one run and it completed successfully, surface it as winner
  if (runs.length === 1 && runs[0].status === "completed") {
    return jsonResponse({ status: "single_winner", winnerRunId: runs[0]._id });
  }

  // Multiple runs complete: caller can proceed to crown evaluation path
  return jsonResponse({ status: "ready_for_crown" });
});
