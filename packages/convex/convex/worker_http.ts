import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { z } from "zod";
import { jwtVerify } from "jose";
import { env } from "../_shared/convex-env";

const JSON_HEADERS = { "content-type": "application/json" } as const;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function ensureJson(req: Request): Promise<{ json: unknown } | Response> {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("application/json")) {
    return json({ code: 415, message: "Content-Type must be application/json" }, 415);
  }
  try {
    const parsed = await req.json();
    return { json: parsed };
  } catch {
    return json({ code: 400, message: "Invalid JSON body" }, 400);
  }
}

const CompletePayload = z.object({
  taskRunId: z.string(),
  exitCode: z.number().optional(),
  teamSlugOrId: z.string().optional(),
});

type TaskRunJwtPayload = {
  taskRunId: Id<"taskRuns">;
  teamId: string;
  userId: string;
  iat?: number;
  exp?: number;
};

export const workerTaskComplete = httpAction(async (ctx, req) => {
  // Use CMUX task run JWT for auth: x-cmux-token header
  const token = req.headers.get("x-cmux-token");
  if (!token) {
    return json({ code: 401, message: "Missing x-cmux-token" }, 401);
  }

  const parsed = await ensureJson(req);
  if (parsed instanceof Response) return parsed;

  const valid = CompletePayload.safeParse(parsed.json);
  if (!valid.success) {
    return json({ code: 400, message: "Invalid input" }, 400);
  }

  // Verify token
  let payload: TaskRunJwtPayload;
  try {
    const secret = new TextEncoder().encode(env.CMUX_TASK_RUN_JWT_SECRET);
    const verification = await jwtVerify(token, secret);
    payload = verification.payload as unknown as TaskRunJwtPayload;
  } catch (e) {
    return json({ code: 401, message: "Invalid token" }, 401);
  }

  const runId = payload.taskRunId;

  // Mark run as completed; robustly retry once on transient write conflict
  let completedOk = false;
  for (let attempt = 0; attempt < 2 && !completedOk; attempt++) {
    try {
      const run = await ctx.db.get(runId);
      if (!run) return json({ code: 404, message: "Run not found" }, 404);
      await ctx.db.patch(runId, {
        status: "completed",
        exitCode: valid.data.exitCode ?? 0,
        completedAt: Date.now(),
        updatedAt: Date.now(),
      });
      completedOk = true;
    } catch (e) {
      if (attempt === 1) throw e;
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  const run = await ctx.db.get(runId);
  if (!run) return json({ code: 404, message: "Run not found" }, 404);

  // Fetch all runs for this task (user/team scoped via stored fields)
  const runs = await ctx.db
    .query("taskRuns")
    .withIndex("by_task", (q) => q.eq("taskId", run.taskId))
    .collect();

  const totalRuns = runs.length;
  const completedRuns = runs.filter((r) => r.status === "completed");
  const failedRuns = runs.filter((r) => r.status === "failed");
  const allCompleted = runs.every(
    (r) => r.status === "completed" || r.status === "failed"
  );

  // If all done, mark the parent task completed (and set status)
  if (allCompleted) {
    try {
      await ctx.db.patch(run.taskId, {
        isCompleted: true,
        status: "complete",
        updatedAt: Date.now(),
      });
    } catch {
      // benign if concurrent
    }
  }

  // Determine whether crown evaluation should run
  const shouldEvaluateCrown = allCompleted && completedRuns.length >= 2;

  // Return enough info for the worker to decide next steps
  return json({
    ok: true,
    taskId: run.taskId,
    teamId: run.teamId,
    allCompleted,
    totalRuns,
    completedCount: completedRuns.length,
    failedCount: failedRuns.length,
    shouldEvaluateCrown,
  });
});
