import { z } from "zod";
import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { jwtVerify } from "jose";
import { env } from "../_shared/convex-env";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";

const JSON_HEADERS = { "content-type": "application/json" } as const;

const CrownEvaluationRequestSchema = z.object({
  prompt: z.string(),
  teamSlugOrId: z.string(),
});

const CrownSummarizationRequestSchema = z.object({
  prompt: z.string(),
  teamSlugOrId: z.string().optional(),
});

const NotifyCompleteRequestSchema = z.object({
  taskRunId: z.string(),
  exitCode: z.number().optional(),
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

function ensureStackAuth(req: Request): Response | void {
  const stackAuthHeader = req.headers.get("x-stack-auth");
  if (!stackAuthHeader) {
    console.error("[convex.crown] Missing x-stack-auth header");
    return jsonResponse({ code: 401, message: "Unauthorized" }, 401);
  }

  try {
    const parsed = JSON.parse(stackAuthHeader) as { accessToken?: string };
    if (!parsed.accessToken) {
      console.error("[convex.crown] Missing access token in x-stack-auth header");
      return jsonResponse({ code: 401, message: "Unauthorized" }, 401);
    }
  } catch (error) {
    console.error("[convex.crown] Failed to parse x-stack-auth header", error);
    return jsonResponse({ code: 400, message: "Invalid stack auth header" }, 400);
  }
}

async function verifyTaskRunToken(
  req: Request
): Promise<
  | Response
  | {
      taskRunId: Id<"taskRuns">;
      teamId: string;
      userId: string;
    }
> {
  const token = req.headers.get("x-cmux-token");
  if (!token) {
    return jsonResponse({ code: 401, message: "Missing x-cmux-token" }, 401);
  }
  try {
    const key = new TextEncoder().encode(env.CMUX_TASK_RUN_JWT_SECRET);
    const { payload } = await jwtVerify(token, key);
    const taskRunId = payload["taskRunId"] as Id<"taskRuns"> | undefined;
    const teamId = payload["teamId"] as string | undefined;
    const userId = payload["userId"] as string | undefined;
    if (!taskRunId || !teamId || !userId) {
      return jsonResponse({ code: 401, message: "Invalid token payload" }, 401);
    }
    return { taskRunId, teamId, userId };
  } catch (e) {
    console.error("[convex.crown] Failed to verify x-cmux-token", e);
    return jsonResponse({ code: 401, message: "Invalid token" }, 401);
  }
}

async function ensureTeamMembership(
  ctx: ActionCtx,
  teamSlugOrId: string
): Promise<Response | { teamId: string }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    console.warn("[convex.crown] Anonymous request rejected");
    return jsonResponse({ code: 401, message: "Unauthorized" }, 401);
  }

  const team = await ctx.runQuery(api.teams.get, { teamSlugOrId });
  if (!team) {
    console.warn("[convex.crown] Team not found", { teamSlugOrId });
    return jsonResponse({ code: 401, message: "Unauthorized" }, 401);
  }

  const memberships = await ctx.runQuery(api.teams.listTeamMemberships, {});
  const hasMembership = memberships.some((membership) => {
    return membership.teamId === team.uuid;
  });

  if (!hasMembership) {
    console.warn("[convex.crown] User missing membership", {
      teamSlugOrId,
      userId: identity.subject,
    });
    return jsonResponse({ code: 401, message: "Unauthorized" }, 401);
  }

  return { teamId: team.uuid };
}

async function resolveTeamSlugOrId(
  ctx: ActionCtx,
  teamSlugOrId?: string
): Promise<Response | { teamSlugOrId: string }> {
  if (teamSlugOrId) {
    const membership = await ensureTeamMembership(ctx, teamSlugOrId);
    if (membership instanceof Response) {
      return membership;
    }
    return { teamSlugOrId };
  }

  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    console.warn("[convex.crown] Anonymous request rejected");
    return jsonResponse({ code: 401, message: "Unauthorized" }, 401);
  }

  const memberships = await ctx.runQuery(api.teams.listTeamMemberships, {});
  if (memberships.length === 0) {
    console.warn("[convex.crown] User has no team memberships", {
      userId: identity.subject,
    });
    return jsonResponse({ code: 401, message: "Unauthorized" }, 401);
  }

  const primary = memberships[0];
  const slugOrId = primary.team?.slug ?? primary.teamId;
  if (!slugOrId) {
    console.error("[convex.crown] Unable to resolve default team", {
      membership: primary,
    });
    return jsonResponse({ code: 500, message: "Team resolution failed" }, 500);
  }

  return { teamSlugOrId: slugOrId };
}

export const crownEvaluate = httpAction(async (ctx, req) => {
  const stackAuthError = ensureStackAuth(req);
  if (stackAuthError) return stackAuthError;

  const parsed = await ensureJsonRequest(req);
  if (parsed instanceof Response) return parsed;

  const validation = CrownEvaluationRequestSchema.safeParse(parsed.json);
  if (!validation.success) {
    console.warn("[convex.crown] Invalid evaluation payload", validation.error);
    return jsonResponse({ code: 400, message: "Invalid input" }, 400);
  }

  const membership = await ensureTeamMembership(
    ctx,
    validation.data.teamSlugOrId
  );
  if (membership instanceof Response) return membership;

  try {
    const result = await ctx.runAction(api.crown.actions.evaluate, {
      prompt: validation.data.prompt,
      teamSlugOrId: validation.data.teamSlugOrId,
    });
    return jsonResponse(result);
  } catch (error) {
    console.error("[convex.crown] Evaluation error", error);
    return jsonResponse({ code: 500, message: "Evaluation failed" }, 500);
  }
});

export const crownSummarize = httpAction(async (ctx, req) => {
  const stackAuthError = ensureStackAuth(req);
  if (stackAuthError) return stackAuthError;

  const parsed = await ensureJsonRequest(req);
  if (parsed instanceof Response) return parsed;

  const validation = CrownSummarizationRequestSchema.safeParse(parsed.json);
  if (!validation.success) {
    console.warn("[convex.crown] Invalid summarization payload", validation.error);
    return jsonResponse({ code: 400, message: "Invalid input" }, 400);
  }

  const resolvedTeam = await resolveTeamSlugOrId(
    ctx,
    validation.data.teamSlugOrId
  );
  if (resolvedTeam instanceof Response) return resolvedTeam;

  try {
    const result = await ctx.runAction(api.crown.actions.summarize, {
      prompt: validation.data.prompt,
      teamSlugOrId: resolvedTeam.teamSlugOrId,
    });
    return jsonResponse(result);
  } catch (error) {
    console.error("[convex.crown] Summarization error", error);
    return jsonResponse({ code: 500, message: "Summarization failed" }, 500);
  }
});

// Notify Convex that a task run has completed, using a taskRun-scoped JWT.
// This marks the run as completed and, if all runs for the task are done,
// initiates the crown evaluation lifecycle by marking it pending.
export const crownNotifyComplete = httpAction(async (ctx, req) => {
  const parsed = await ensureJsonRequest(req);
  if (parsed instanceof Response) return parsed;

  const auth = await verifyTaskRunToken(req);
  if (auth instanceof Response) return auth;

  const validation = NotifyCompleteRequestSchema.safeParse(parsed.json);
  if (!validation.success) {
    console.warn(
      "[convex.crown] Invalid notify-complete payload",
      validation.error
    );
    return jsonResponse({ code: 400, message: "Invalid input" }, 400);
  }

  const bodyTaskRunId = validation.data.taskRunId as Id<"taskRuns">;
  const exitCode = validation.data.exitCode ?? 0;

  if (bodyTaskRunId !== auth.taskRunId) {
    return jsonResponse({ code: 401, message: "Token mismatch" }, 401);
  }

  try {
    // Fetch the run to confirm team/user ownership
    const run = await ctx.runQuery(api.taskRuns.getById, {
      id: auth.taskRunId,
    });
    if (!run || run.teamId !== auth.teamId || run.userId !== auth.userId) {
      return jsonResponse({ code: 404, message: "Run not found" }, 404);
    }

    // If already in a terminal state, return early (idempotent)
    if (run.status === "completed" || run.status === "failed") {
      return jsonResponse({ status: "ok", alreadyCompleted: true });
    }

    // Mark run completed
    await ctx.runMutation(api.taskRuns.updateStatus, {
      id: auth.taskRunId,
      status: "completed",
      exitCode,
    });

    // Check if all runs for this task (for this team+user) are completed/failed
    const runs = await ctx.runQuery(api.taskRuns.listByTaskForTeamUser, {
      taskId: run.taskId,
      teamId: auth.teamId,
      userId: auth.userId,
    });

    const allDone = runs.every(
      (r) => r.status === "completed" || r.status === "failed"
    );
    if (!allDone) {
      return jsonResponse({ status: "partial" });
    }

    // All done. For single-run tasks, mark task complete and return winner id if success
    if (runs.length === 1) {
      await ctx.runMutation(api.tasks.internalMarkTaskCompleted, {
        id: run.taskId,
        teamId: auth.teamId,
        userId: auth.userId,
      });
      const single = runs[0];
      return jsonResponse({
        status: "completed",
        winnerId: single.status === "completed" ? single._id : null,
      });
    }

    // Multi-run: ensure at least two completed runs to evaluate
    const completedRuns = runs.filter((r) => r.status === "completed");
    if (completedRuns.length < 2) {
      // Mark the task completed but no evaluation
      await ctx.runMutation(api.tasks.internalMarkTaskCompleted, {
        id: run.taskId,
        teamId: auth.teamId,
        userId: auth.userId,
      });
      return jsonResponse({ status: "completed", winnerId: null });
    }

    // If already evaluated, return the winner id
    const existing = await ctx.runQuery(api.crown.internalGetEvaluationByTask, {
      taskId: run.taskId,
      teamId: auth.teamId,
      userId: auth.userId,
    });
    if (existing?.winnerRunId) {
      return jsonResponse({ status: "evaluated", winnerId: existing.winnerRunId });
    }

    // Mark crown evaluation pending, unless already pending/in_progress
    const pendingState = await ctx.runMutation(
      api.tasks.internalMarkCrownPending,
      {
        id: run.taskId,
        teamId: auth.teamId,
        userId: auth.userId,
      }
    );

    // Mark the task complete as all runs are finalized
    await ctx.runMutation(api.tasks.internalMarkTaskCompleted, {
      id: run.taskId,
      teamId: auth.teamId,
      userId: auth.userId,
    });

    return jsonResponse({ status: pendingState });
  } catch (error) {
    console.error("[convex.crown] notify-complete error", error);
    return jsonResponse({ code: 500, message: "Completion handling failed" }, 500);
  }
});

