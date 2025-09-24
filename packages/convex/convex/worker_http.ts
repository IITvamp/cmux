import { z } from "zod";
import {
  verifyTaskRunToken,
  type TaskRunTokenPayload,
} from "../_shared/taskRunToken";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";

const JSON_HEADERS = { "content-type": "application/json" } as const;

const WorkerCompleteRequestSchema = z.object({
  taskRunId: z.string(),
  exitCode: z.number().optional(),
});

const WorkerScheduleRequestSchema = z.object({
  taskRunId: z.string(),
  scheduledStopAt: z.number().optional(),
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function ensureJsonRequest(
  req: Request
): Promise<{ json: unknown } | Response> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonResponse(
      { code: 415, message: "Content-Type must be application/json" },
      415
    );
  }

  try {
    const json = await req.json();
    return { json };
  } catch {
    return jsonResponse({ code: 400, message: "Invalid JSON body" }, 400);
  }
}

async function ensureWorkerAuth(
  req: Request
): Promise<Response | { token: string; payload: TaskRunTokenPayload }> {
  const token = req.headers.get("x-cmux-token");
  if (!token) {
    console.warn("[worker_http] Missing x-cmux-token header");
    return jsonResponse({ code: 401, message: "Unauthorized" }, 401);
  }

  try {
    const payload = await verifyTaskRunToken(token);
    return { token, payload };
  } catch (error) {
    console.error("[worker_http] Failed to verify task run token", error);
    return jsonResponse({ code: 401, message: "Unauthorized" }, 401);
  }
}

async function loadTaskRun(
  ctx: ActionCtx,
  auth: { payload: TaskRunTokenPayload },
  taskRunId: Id<"taskRuns">
): Promise<Response | Doc<"taskRuns">> {
  const run = await ctx.runQuery(internal.taskRuns.getById, { id: taskRunId });
  if (!run) {
    console.warn("[worker_http] Task run not found", { taskRunId });
    return jsonResponse({ code: 404, message: "Task run not found" }, 404);
  }

  if (
    run.teamId !== auth.payload.teamId ||
    run.userId !== auth.payload.userId
  ) {
    console.warn("[worker_http] Unauthorized task run access", {
      taskRunId,
      workerTeamId: auth.payload.teamId,
      runTeamId: run.teamId,
    });
    return jsonResponse({ code: 401, message: "Unauthorized" }, 401);
  }

  return run;
}

export const workerComplete = httpAction(async (ctx, req) => {
  const auth = await ensureWorkerAuth(req);
  if (auth instanceof Response) return auth;

  const parsed = await ensureJsonRequest(req);
  if (parsed instanceof Response) return parsed;

  const validation = WorkerCompleteRequestSchema.safeParse(parsed.json);
  if (!validation.success) {
    console.warn(
      "[worker_http] Invalid worker complete payload",
      validation.error
    );
    return jsonResponse({ code: 400, message: "Invalid input" }, 400);
  }

  const taskRunId = validation.data.taskRunId as Id<"taskRuns">;
  const existingRun = await loadTaskRun(ctx, auth, taskRunId);
  if (existingRun instanceof Response) return existingRun;

  await ctx.runMutation(internal.taskRuns.workerComplete, {
    taskRunId,
    exitCode: validation.data.exitCode,
  });

  const updatedRun = await ctx.runQuery(internal.taskRuns.getById, {
    id: taskRunId,
  });

  const task = updatedRun
    ? await ctx.runQuery(internal.tasks.getByIdInternal, {
        id: updatedRun.taskId,
      })
    : null;

  const containerSettings = await ctx.runQuery(
    internal.containerSettings.getEffectiveInternal,
    {
      teamId: auth.payload.teamId,
      userId: auth.payload.userId,
    }
  );

  return jsonResponse({
    ok: true,
    taskRun: updatedRun
      ? {
          id: updatedRun._id,
          taskId: updatedRun.taskId,
          teamId: updatedRun.teamId,
          newBranch: updatedRun.newBranch ?? null,
          agentName: updatedRun.agentName ?? null,
        }
      : null,
    task: task
      ? {
          id: task._id,
          text: task.text,
        }
      : null,
    containerSettings: containerSettings
      ? {
          autoCleanupEnabled: containerSettings.autoCleanupEnabled,
          stopImmediatelyOnCompletion:
            containerSettings.stopImmediatelyOnCompletion,
          reviewPeriodMinutes: containerSettings.reviewPeriodMinutes,
        }
      : null,
  });
});

export const workerScheduleStop = httpAction(async (ctx, req) => {
  const auth = await ensureWorkerAuth(req);
  if (auth instanceof Response) return auth;

  const parsed = await ensureJsonRequest(req);
  if (parsed instanceof Response) return parsed;

  const validation = WorkerScheduleRequestSchema.safeParse(parsed.json);
  if (!validation.success) {
    console.warn(
      "[worker_http] Invalid worker schedule payload",
      validation.error
    );
    return jsonResponse({ code: 400, message: "Invalid input" }, 400);
  }

  const taskRunId = validation.data.taskRunId as Id<"taskRuns">;
  const existingRun = await loadTaskRun(ctx, auth, taskRunId);
  if (existingRun instanceof Response) return existingRun;

  await ctx.runMutation(internal.taskRuns.updateScheduledStopInternal, {
    taskRunId,
    scheduledStopAt: validation.data.scheduledStopAt,
  });

  return jsonResponse({ ok: true });
});
