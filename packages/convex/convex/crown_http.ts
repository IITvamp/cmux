import { z } from "zod";
import { jwtVerify } from "jose";
import { api, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { env } from "../_shared/convex-env";

const JSON_HEADERS = { "content-type": "application/json" } as const;

const CrownEvaluationRequestSchema = z.object({
  prompt: z.string(),
  teamSlugOrId: z.string(),
});

const CrownSummarizationRequestSchema = z.object({
  prompt: z.string(),
  teamSlugOrId: z.string().optional(),
});

const TaskRunTokenPayloadSchema = z.object({
  taskRunId: z.string().min(1),
  teamId: z.string().min(1),
  userId: z.string().min(1),
});

type TaskRunTokenPayload = z.infer<typeof TaskRunTokenPayloadSchema>;

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

async function verifyTaskRunJwt(jwt: string): Promise<TaskRunTokenPayload> {
  const secret = new TextEncoder().encode(env.CMUX_TASK_RUN_JWT_SECRET);
  const verification = await jwtVerify(jwt, secret);
  const parsed = TaskRunTokenPayloadSchema.safeParse(verification.payload);
  if (!parsed.success) {
    throw new Error("Invalid CMUX task run token payload");
  }
  return parsed.data;
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

const CrownWorkerContextRequestSchema = z.object({
  taskRunJwt: z.string(),
});

const CrownWorkerBeginRequestSchema = CrownWorkerContextRequestSchema.extend({
  taskId: z.string(),
});

const CrownWorkerFinalizeRequestSchema = CrownWorkerContextRequestSchema.extend({
  taskId: z.string(),
  winnerRunId: z.string(),
  reason: z.string(),
  candidateRunIds: z.array(z.string()),
  winnerDiff: z.string(),
  originalRequest: z.string().optional(),
  baseRef: z.string().optional(),
});

const CrownWorkerFailRequestSchema = CrownWorkerContextRequestSchema.extend({
  taskId: z.string(),
  errorMessage: z.string().min(1),
});

const CrownWorkerEvaluateRequestSchema = CrownWorkerContextRequestSchema.extend({
  prompt: z.string(),
});

export const crownWorkerContext = httpAction(async (ctx, req) => {
  const parsed = await ensureJsonRequest(req);
  if (parsed instanceof Response) return parsed;

  const validation = CrownWorkerContextRequestSchema.safeParse(parsed.json);
  if (!validation.success) {
    return jsonResponse({ code: 400, message: "Invalid input" }, 400);
  }

  try {
    const payload = await verifyTaskRunJwt(validation.data.taskRunJwt);
    const result = await ctx.runQuery(internal.crown_worker.workerContext, {
      taskRunId: payload.taskRunId as Id<"taskRuns">,
      teamId: payload.teamId,
      userId: payload.userId,
    });

    return jsonResponse(result);
  } catch (error) {
    console.error("[convex.crown] worker context error", error);
    return jsonResponse({ code: 401, message: "Unauthorized" }, 401);
  }
});

export const crownWorkerBegin = httpAction(async (ctx, req) => {
  const parsed = await ensureJsonRequest(req);
  if (parsed instanceof Response) return parsed;

  const validation = CrownWorkerBeginRequestSchema.safeParse(parsed.json);
  if (!validation.success) {
    return jsonResponse({ code: 400, message: "Invalid input" }, 400);
  }

  try {
    const payload = await verifyTaskRunJwt(validation.data.taskRunJwt);
    const result = await ctx.runMutation(internal.crown_worker.workerBegin, {
      taskId: validation.data.taskId as Id<"tasks">,
      teamId: payload.teamId,
      userId: payload.userId,
    });

    return jsonResponse(result);
  } catch (error) {
    console.error("[convex.crown] worker begin error", error);
    return jsonResponse({ code: 401, message: "Unauthorized" }, 401);
  }
});

export const crownWorkerEvaluate = httpAction(async (ctx, req) => {
  const parsed = await ensureJsonRequest(req);
  if (parsed instanceof Response) return parsed;

  const validation = CrownWorkerEvaluateRequestSchema.safeParse(parsed.json);
  if (!validation.success) {
    return jsonResponse({ code: 400, message: "Invalid input" }, 400);
  }

  try {
    const payload = await verifyTaskRunJwt(validation.data.taskRunJwt);
    await ctx.runQuery(internal.crown_worker.workerContext, {
      taskRunId: payload.taskRunId as Id<"taskRuns">,
      teamId: payload.teamId,
      userId: payload.userId,
    });

    const result = await ctx.runAction(api.crown.actions.evaluate, {
      prompt: validation.data.prompt,
      teamSlugOrId: payload.teamId,
    });

    return jsonResponse(result);
  } catch (error) {
    console.error("[convex.crown] worker evaluate error", error);
    return jsonResponse({ code: 401, message: "Unauthorized" }, 401);
  }
});

export const crownWorkerFinalize = httpAction(async (ctx, req) => {
  const parsed = await ensureJsonRequest(req);
  if (parsed instanceof Response) return parsed;

  const validation = CrownWorkerFinalizeRequestSchema.safeParse(parsed.json);
  if (!validation.success) {
    return jsonResponse({ code: 400, message: "Invalid input" }, 400);
  }

  try {
    const payload = await verifyTaskRunJwt(validation.data.taskRunJwt);

    const context = await ctx.runQuery(internal.crown_worker.workerContext, {
      taskRunId: payload.taskRunId as Id<"taskRuns">,
      teamId: payload.teamId,
      userId: payload.userId,
    });

    const summarizationPrompt = `You are an expert reviewer summarizing a pull request.\n\nGOAL\n- Explain succinctly what changed and why.\n- Call out areas the user should review carefully.\n- Provide a quick test plan to validate the changes.\n\nCONTEXT\n- User's original request:\n${validation.data.originalRequest ?? ""}\n- Relevant diffs (unified):\n${validation.data.winnerDiff || "<no code changes captured>"}\n\nINSTRUCTIONS\n- Base your summary strictly on the provided diffs and request.\n- Be specific about files and functions when possible.\n- Prefer clear bullet points over prose. Keep it under ~300 words.\n- If there are no code changes, say so explicitly and suggest next steps.\n\nOUTPUT FORMAT (Markdown)\n## PR Review Summary\n- What Changed: bullet list\n- Review Focus: bullet list (risks/edge cases)\n- Test Plan: bullet list of practical steps\n- Follow-ups: optional bullets if applicable\n`;

    let summaryText = "";
    try {
      const summary = await ctx.runAction(api.crown.actions.summarize, {
        prompt: summarizationPrompt,
        teamSlugOrId: payload.teamId,
      });
      summaryText = summary.summary;
    } catch (error) {
      console.error("[convex.crown] Failed to generate system summary", error);
    }

    await ctx.runMutation(internal.crown_worker.workerFinalize, {
      taskId: context.taskId as Id<"tasks">,
      teamId: payload.teamId,
      userId: payload.userId,
      winnerRunId: validation.data.winnerRunId as Id<"taskRuns">,
      reason: validation.data.reason,
      candidateRunIds: validation.data
        .candidateRunIds as unknown as Id<"taskRuns">[],
      summaryText,
    });

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("[convex.crown] worker finalize error", error);
    return jsonResponse({ code: 401, message: "Unauthorized" }, 401);
  }
});

export const crownWorkerFail = httpAction(async (ctx, req) => {
  const parsed = await ensureJsonRequest(req);
  if (parsed instanceof Response) return parsed;

  const validation = CrownWorkerFailRequestSchema.safeParse(parsed.json);
  if (!validation.success) {
    return jsonResponse({ code: 400, message: "Invalid input" }, 400);
  }

  try {
    const payload = await verifyTaskRunJwt(validation.data.taskRunJwt);
    await ctx.runMutation(internal.crown_worker.workerFail, {
      taskId: validation.data.taskId as Id<"tasks">,
      teamId: payload.teamId,
      userId: payload.userId,
      errorMessage: validation.data.errorMessage,
    });

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("[convex.crown] worker fail error", error);
    return jsonResponse({ code: 401, message: "Unauthorized" }, 401);
  }
});
