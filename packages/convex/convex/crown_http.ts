import {
  verifyTaskRunToken,
  type CrownWorkerCheckResponse,
  type TaskRunTokenPayload,
  type WorkerAllRunsCompleteResponse,
  type WorkerRunStatus,
  type WorkerTaskRunResponse,
} from "../../shared/src/convex-safe";
import { z } from "zod";
import { env } from "../_shared/convex-env";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";

const JSON_HEADERS = { "content-type": "application/json" } as const;

const CrownEvaluationCandidateSchema = z.object({
  runId: z.string().optional(),
  agentName: z.string().optional(),
  modelName: z.string().optional(),
  gitDiff: z.string(),
  newBranch: z.string().optional(),
  index: z.number().optional(),
});

const CrownEvaluationRequestSchema = z.object({
  taskText: z.string(),
  candidates: z.array(CrownEvaluationCandidateSchema).min(1),
  teamSlugOrId: z.string(),
});

const CrownEvaluationPromptSchema = z.object({
  prompt: z.string(),
  teamSlugOrId: z.string(),
});

const CrownSummarizationRequestSchema = z.object({
  taskText: z.string(),
  gitDiff: z.string(),
  teamSlugOrId: z.string().optional(),
});

const CrownSummarizationPromptSchema = z.object({
  prompt: z.string(),
  teamSlugOrId: z.string(),
});

const WorkerCheckSchema = z.object({
  taskId: z.string().optional(),
  taskRunId: z.string().optional(),
  checkType: z.enum(["info", "all-complete", "crown"]).optional(),
});

const WorkerFinalizeSchema = z.object({
  taskId: z.string(),
  winnerRunId: z.string(),
  reason: z.string(),
  evaluationPrompt: z.string(),
  evaluationResponse: z.string(),
  candidateRunIds: z.array(z.string()).min(1),
  summary: z.string().optional(),
  pullRequest: z
    .object({
      url: z.url(),
      isDraft: z.boolean().optional(),
      state: z
        .union([
          z.literal("none"),
          z.literal("draft"),
          z.literal("open"),
          z.literal("merged"),
          z.literal("closed"),
          z.literal("unknown"),
        ])
        .optional(),
      number: z.number().int().optional(),
    })
    .optional(),
  pullRequestTitle: z.string().optional(),
  pullRequestDescription: z.string().optional(),
});

const WorkerCompleteRequestSchema = z.object({
  taskRunId: z.string(),
  exitCode: z.number().optional(),
});

const WorkerScheduleRequestSchema = z.object({
  taskRunId: z.string(),
  scheduledStopAt: z.number().optional(),
});

type CrownEvaluationRequest = z.infer<typeof CrownEvaluationRequestSchema>;
type CrownEvaluationCandidate = z.infer<typeof CrownEvaluationCandidateSchema>;

type ParseEvaluationRequestResult =
  | { ok: true; data: CrownEvaluationRequest }
  | { ok: false; errors: Array<{ message: string; details?: unknown }> };

type CrownSummarizationRequest = z.infer<typeof CrownSummarizationRequestSchema>;

type ParseSummarizationRequestResult =
  | { ok: true; data: CrownSummarizationRequest }
  | { ok: false; errors: Array<{ message: string; details?: unknown }> };

function parseEvaluationRequestBody(
  json: unknown,
): ParseEvaluationRequestResult {
  const legacy = CrownEvaluationRequestSchema.safeParse(json);
  if (legacy.success) {
    return { ok: true, data: legacy.data };
  }

  const errors: Array<{ message: string; details?: unknown }> = [
    { message: "legacy_schema_failed", details: legacy.error },
  ];

  const promptPayload = CrownEvaluationPromptSchema.safeParse(json);
  if (!promptPayload.success) {
    errors.push({
      message: "prompt_schema_failed",
      details: promptPayload.error,
    });
    return { ok: false, errors };
  }

  const converted = convertPromptPayload(
    promptPayload.data.prompt,
    promptPayload.data.teamSlugOrId,
  );
  if (!converted.ok) {
    errors.push(converted.error);
    return { ok: false, errors };
  }

  return { ok: true, data: converted.data };
}

function convertPromptPayload(
  prompt: string,
  teamSlugOrId: string,
):
  | { ok: true; data: CrownEvaluationRequest }
  | { ok: false; error: { message: string; details?: unknown } } {
  const jsonBlock = extractFirstJsonObject(prompt);
  if (!jsonBlock) {
    return { ok: false, error: { message: "prompt_missing_json_block" } };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonBlock);
  } catch (error) {
    return {
      ok: false,
      error: {
        message: "prompt_json_parse_failed",
        details: { error, jsonBlock },
      },
    };
  }

  if (!parsed || typeof parsed !== "object") {
    return {
      ok: false,
      error: {
        message: "prompt_json_not_object",
        details: { parsedType: typeof parsed },
      },
    };
  }

  const record = parsed as Record<string, unknown>;
  const taskTextValue = record.task ?? record.taskText;
  if (typeof taskTextValue !== "string" || taskTextValue.trim() === "") {
    return { ok: false, error: { message: "prompt_missing_task_text" } };
  }

  const rawCandidates = Array.isArray(record.implementations)
    ? record.implementations
    : Array.isArray(record.candidates)
      ? record.candidates
      : null;

  if (!rawCandidates || rawCandidates.length === 0) {
    return { ok: false, error: { message: "prompt_missing_candidates" } };
  }

  const candidates: CrownEvaluationCandidate[] = [];
  for (let i = 0; i < rawCandidates.length; i++) {
    const rawCandidate = rawCandidates[i];
    if (!rawCandidate || typeof rawCandidate !== "object") {
      return {
        ok: false,
        error: {
          message: "prompt_candidate_not_object",
          details: { index: i },
        },
      };
    }

    const candidateRecord = rawCandidate as Record<string, unknown>;
    const gitDiffValue = candidateRecord.gitDiff;
    if (typeof gitDiffValue !== "string") {
      return {
        ok: false,
        error: {
          message: "prompt_candidate_missing_git_diff",
          details: { index: i },
        },
      };
    }

    candidates.push({
      gitDiff: gitDiffValue,
      runId:
        typeof candidateRecord.runId === "string"
          ? candidateRecord.runId
          : undefined,
      agentName:
        typeof candidateRecord.agentName === "string"
          ? candidateRecord.agentName
          : undefined,
      modelName:
        typeof candidateRecord.modelName === "string"
          ? candidateRecord.modelName
          : undefined,
      newBranch:
        typeof candidateRecord.newBranch === "string"
          ? candidateRecord.newBranch
          : undefined,
      index:
        typeof candidateRecord.index === "number"
          ? candidateRecord.index
          : undefined,
    });
  }

  const normalized = CrownEvaluationRequestSchema.safeParse({
    taskText: taskTextValue,
    candidates,
    teamSlugOrId,
  });

  if (!normalized.success) {
    return {
      ok: false,
      error: {
        message: "prompt_conversion_failed_validation",
        details: normalized.error,
      },
    };
  }

  return { ok: true, data: normalized.data };
}

function parseSummarizationRequestBody(
  json: unknown,
): ParseSummarizationRequestResult {
  const legacy = CrownSummarizationRequestSchema.safeParse(json);
  if (legacy.success) {
    return { ok: true, data: legacy.data };
  }

  const errors: Array<{ message: string; details?: unknown }> = [
    { message: "legacy_schema_failed", details: legacy.error },
  ];

  const promptPayload = CrownSummarizationPromptSchema.safeParse(json);
  if (!promptPayload.success) {
    errors.push({
      message: "prompt_schema_failed",
      details: promptPayload.error,
    });
    return { ok: false, errors };
  }

  const converted = convertSummarizationPrompt(
    promptPayload.data.prompt,
    promptPayload.data.teamSlugOrId,
  );

  if (!converted.ok) {
    errors.push(converted.error);
    return { ok: false, errors };
  }

  return { ok: true, data: converted.data };
}

function convertSummarizationPrompt(
  prompt: string,
  teamSlugOrId: string,
):
  | { ok: true; data: CrownSummarizationRequest }
  | { ok: false; error: { message: string; details?: unknown } } {
  const jsonBlock = extractFirstJsonObject(prompt);
  if (!jsonBlock) {
    return { ok: false, error: { message: "prompt_missing_json_block" } };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonBlock);
  } catch (error) {
    return {
      ok: false,
      error: {
        message: "prompt_json_parse_failed",
        details: { error, jsonBlock },
      },
    };
  }

  if (!parsed || typeof parsed !== "object") {
    return {
      ok: false,
      error: {
        message: "prompt_json_not_object",
        details: { parsedType: typeof parsed },
      },
    };
  }

  const record = parsed as Record<string, unknown>;

  const taskTextCandidates = [
    record.taskText,
    record.task,
    record.request,
    record.description,
    record.title,
  ];
  const taskTextValue = taskTextCandidates.find((value): value is string => {
    return typeof value === "string" && value.trim() !== "";
  });
  if (!taskTextValue) {
    return { ok: false, error: { message: "prompt_missing_task_text" } };
  }

  const diffCandidates = [
    record.gitDiff,
    record.diff,
    record.diffText,
    record.git_diff,
    record.diffSummary,
    record.branchDiff,
  ];
  const gitDiffValue = diffCandidates.find(
    (value): value is string => typeof value === "string",
  );
  if (!gitDiffValue) {
    return { ok: false, error: { message: "prompt_missing_git_diff" } };
  }

  const normalized = CrownSummarizationRequestSchema.safeParse({
    taskText: taskTextValue,
    gitDiff: gitDiffValue,
    teamSlugOrId,
  });

  if (!normalized.success) {
    return {
      ok: false,
      error: {
        message: "prompt_conversion_failed_validation",
        details: normalized.error,
      },
    };
  }

  return { ok: true, data: normalized.data };
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === "\\") {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function buildEvaluationCandidates(
  candidates: CrownEvaluationCandidate[],
): Array<{ modelName: string; gitDiff: string; index: number }> {
  return candidates.map((candidate, index) => ({
    modelName:
      candidate.agentName ??
      candidate.modelName ??
      `candidate-${candidate.index ?? index}`,
    gitDiff: candidate.gitDiff,
    index: candidate.index ?? index,
  }));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function ensureJsonRequest(
  req: Request,
): Promise<{ json: unknown } | Response> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonResponse(
      { code: 415, message: "Content-Type must be application/json" },
      415,
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
      console.error(
        "[convex.crown] Missing access token in x-stack-auth header",
      );
      return jsonResponse({ code: 401, message: "Unauthorized" }, 401);
    }
  } catch (error) {
    console.error("[convex.crown] Failed to parse x-stack-auth header", error);
    return jsonResponse(
      { code: 400, message: "Invalid stack auth header" },
      400,
    );
  }
}

async function ensureTeamMembership(
  ctx: ActionCtx,
  teamSlugOrId: string,
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
  teamSlugOrId?: string,
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

type WorkerAuthContext = {
  token: string;
  payload: TaskRunTokenPayload;
};

async function ensureWorkerAuth(
  req: Request,
): Promise<Response | WorkerAuthContext> {
  const token = req.headers.get("x-cmux-token");
  if (!token) {
    console.warn("[convex.crown] Missing x-cmux-token header");
    return jsonResponse({ code: 401, message: "Unauthorized" }, 401);
  }

  try {
    const payload = await verifyTaskRunToken(
      token,
      env.CMUX_TASK_RUN_JWT_SECRET,
    );
    return { token, payload };
  } catch (error) {
    console.error("[convex.crown] Failed to verify task run token", error);
    return jsonResponse({ code: 401, message: "Unauthorized" }, 401);
  }
}

async function getOptionalWorkerAuth(
  req: Request,
): Promise<Response | WorkerAuthContext | null> {
  const token = req.headers.get("x-cmux-token");
  if (!token) return null;
  return await ensureWorkerAuth(req);
}

async function loadTaskRunForWorker(
  ctx: ActionCtx,
  auth: WorkerAuthContext,
  runId?: string,
): Promise<Response | Doc<"taskRuns">> {
  const taskRunId = (runId ?? auth.payload.taskRunId) as Id<"taskRuns">;
  const taskRun = await ctx.runQuery(internal.taskRuns.getById, {
    id: taskRunId,
  });
  if (!taskRun) {
    console.warn("[convex.crown] Task run not found for worker", {
      taskRunId,
    });
    return jsonResponse({ code: 404, message: "Task run not found" }, 404);
  }

  if (
    taskRun.teamId !== auth.payload.teamId ||
    taskRun.userId !== auth.payload.userId
  ) {
    console.warn(
      "[convex.crown] Worker attempted to access unauthorized task run",
      {
        taskRunId,
        workerTeamId: auth.payload.teamId,
        taskRunTeamId: taskRun.teamId,
      },
    );
    return jsonResponse({ code: 401, message: "Unauthorized" }, 401);
  }

  return taskRun;
}

export const crownEvaluate = httpAction(async (ctx, req) => {
  console.log("[convex.crown] Evaluate endpoint called", {
    url: req.url,
    method: req.method,
    hasCmuxToken: !!req.headers.get("x-cmux-token"),
    hasStackAuth: !!req.headers.get("x-stack-auth"),
  });

  const workerAuthResult = await getOptionalWorkerAuth(req);
  if (workerAuthResult instanceof Response) return workerAuthResult;
  const workerAuth = workerAuthResult;

  if (!workerAuth) {
    const stackAuthError = ensureStackAuth(req);
    if (stackAuthError) throw stackAuthError;
  }

  const parsed = await ensureJsonRequest(req);
  if (parsed instanceof Response) return parsed;

  console.log("[convex.crown] Parsed request body", {
    bodyType: typeof parsed.json,
    bodyKeys:
      parsed.json && typeof parsed.json === "object"
        ? Object.keys(parsed.json as Record<string, unknown>)
        : null,
    body: JSON.stringify(parsed.json),
  });

  const evaluationPayload = parseEvaluationRequestBody(parsed.json);
  if (!evaluationPayload.ok) {
    console.warn("[convex.crown] Invalid evaluation payload", {
      errors: evaluationPayload.errors,
      receivedBody: parsed.json,
    });
    return jsonResponse({ code: 400, message: "Invalid input" }, 400);
  }

  const normalizedEvaluation = evaluationPayload.data;

  const teamSlugOrId = workerAuth
    ? workerAuth.payload.teamId
    : normalizedEvaluation.teamSlugOrId;

  if (!teamSlugOrId) {
    return jsonResponse(
      { code: 400, message: "teamSlugOrId is required" },
      400,
    );
  }

  if (!workerAuth) {
    const membership = await ensureTeamMembership(ctx, teamSlugOrId);
    if (membership instanceof Response) return membership;
  }

  try {
    const candidates = buildEvaluationCandidates(
      normalizedEvaluation.candidates,
    );

    const result = await ctx.runAction(api.crown.actions.evaluate, {
      taskText: normalizedEvaluation.taskText,
      candidates,
      teamSlugOrId,
    });
    return jsonResponse(result);
  } catch (error) {
    console.error("[convex.crown] Evaluation error", error);
    return jsonResponse({ code: 500, message: "Evaluation failed" }, 500);
  }
});

export const crownSingleRun = httpAction(async (ctx, req) => {
  const workerAuthResult = await getOptionalWorkerAuth(req);
  if (workerAuthResult instanceof Response) return workerAuthResult;
  const workerAuth = workerAuthResult;

  if (!workerAuth) {
    const stackAuthError = ensureStackAuth(req);
    if (stackAuthError) throw stackAuthError;
  }

  const parsed = await ensureJsonRequest(req);
  if (parsed instanceof Response) return parsed;

  const evaluationPayload = parseEvaluationRequestBody(parsed.json);
  if (!evaluationPayload.ok) {
    console.warn("[convex.crown] Invalid single-run payload", {
      errors: evaluationPayload.errors,
      receivedBody: parsed.json,
    });
    return jsonResponse({ code: 400, message: "Invalid input" }, 400);
  }

  const normalizedEvaluation = evaluationPayload.data;

  const teamSlugOrId = workerAuth
    ? workerAuth.payload.teamId
    : normalizedEvaluation.teamSlugOrId;

  if (!teamSlugOrId) {
    return jsonResponse(
      { code: 400, message: "teamSlugOrId is required" },
      400,
    );
  }

  if (!workerAuth) {
    const membership = await ensureTeamMembership(ctx, teamSlugOrId);
    if (membership instanceof Response) return membership;
  }

  // For single run, we still evaluate but with only one candidate
  try {
    const candidates = buildEvaluationCandidates(
      normalizedEvaluation.candidates,
    );

    const result = await ctx.runAction(api.crown.actions.evaluate, {
      taskText: normalizedEvaluation.taskText,
      candidates,
      teamSlugOrId,
    });
    return jsonResponse(result);
  } catch (error) {
    console.error("[convex.crown] Single-run evaluation error", error);
    return jsonResponse({ code: 500, message: "Evaluation failed" }, 500);
  }
});

export const crownSummarize = httpAction(async (ctx, req) => {
  const workerAuthResult = await getOptionalWorkerAuth(req);
  if (workerAuthResult instanceof Response) return workerAuthResult;
  const workerAuth = workerAuthResult;

  if (!workerAuth) {
    const stackAuthError = ensureStackAuth(req);
    if (stackAuthError) throw stackAuthError;
  }

  const parsed = await ensureJsonRequest(req);
  if (parsed instanceof Response) return parsed;

  const summarizationPayload = parseSummarizationRequestBody(parsed.json);
  if (!summarizationPayload.ok) {
    console.warn("[convex.crown] Invalid summarization payload", {
      errors: summarizationPayload.errors,
      receivedBody: parsed.json,
    });
    return jsonResponse({ code: 400, message: "Invalid input" }, 400);
  }

  const normalizedSummarization = summarizationPayload.data;

  let teamSlugOrId = normalizedSummarization.teamSlugOrId;
  if (workerAuth) {
    teamSlugOrId = workerAuth.payload.teamId;
  } else {
    const resolvedTeam = await resolveTeamSlugOrId(ctx, teamSlugOrId);
    if (resolvedTeam instanceof Response) return resolvedTeam;
    teamSlugOrId = resolvedTeam.teamSlugOrId;
  }

  if (!teamSlugOrId) {
    return jsonResponse(
      { code: 400, message: "teamSlugOrId is required" },
      400,
    );
  }

  try {
    const result = await ctx.runAction(api.crown.actions.summarize, {
      taskText: normalizedSummarization.taskText,
      gitDiff: normalizedSummarization.gitDiff,
      teamSlugOrId,
    });
    return jsonResponse(result);
  } catch (error) {
    console.error("[convex.crown] Summarization error", error);
    return jsonResponse({ code: 500, message: "Summarization failed" }, 500);
  }
});

export const crownWorkerCheck = httpAction(async (ctx, req) => {
  console.log("[convex.crown] Worker check endpoint called", {
    path: req.url,
    method: req.method,
    hasToken: !!req.headers.get("x-cmux-token"),
  });

  const workerAuth = await ensureWorkerAuth(req);
  if (workerAuth instanceof Response) return workerAuth;

  if (!workerAuth) {
    const stackAuthError = ensureStackAuth(req);
    if (stackAuthError) throw stackAuthError;
  }

  const parsed = await ensureJsonRequest(req);
  if (parsed instanceof Response) return parsed;

  const validation = WorkerCheckSchema.safeParse(parsed.json ?? {});
  if (!validation.success) {
    console.warn(
      "[convex.crown] Invalid worker check payload",
      validation.error,
    );
    return jsonResponse({ code: 400, message: "Invalid input" }, 400);
  }

  // Handle different check types
  const checkType = validation.data.checkType ?? "crown";

  console.log("[convex.crown] Worker check type", {
    checkType,
    taskRunId: validation.data.taskRunId,
    taskId: validation.data.taskId,
  });

  // For "info" check, just return task run info without updating status
  if (checkType === "info" && validation.data.taskRunId) {
    const taskRunId = validation.data.taskRunId as Id<"taskRuns">;
    console.log("[convex.crown] Fetching task run info", { taskRunId });
    const taskRun = await ctx.runQuery(internal.taskRuns.getById, {
      id: taskRunId,
    });
    if (!taskRun) {
      console.error("[convex.crown] Task run not found", { taskRunId });
      return jsonResponse({ code: 404, message: "Task run not found" }, 404);
    }
    if (
      taskRun.teamId !== workerAuth.payload.teamId ||
      taskRun.userId !== workerAuth.payload.userId
    ) {
      return jsonResponse({ code: 401, message: "Unauthorized" }, 401);
    }

    const task = await ctx.runQuery(internal.tasks.getByIdInternal, {
      id: taskRun.taskId,
    });

    const response = {
      ok: true,
      taskRun: {
        id: taskRun._id,
        taskId: taskRun.taskId,
        teamId: taskRun.teamId,
        newBranch: taskRun.newBranch ?? null,
        agentName: taskRun.agentName ?? null,
      },
      task: task
        ? {
            id: task._id,
            text: task.text,
          }
        : null,
    } satisfies WorkerTaskRunResponse;
    return jsonResponse(response);
  }

  // For "all-complete" check, check if all runs for a task are complete
  if (checkType === "all-complete" && validation.data.taskId) {
    const taskId = validation.data.taskId as Id<"tasks">;
    console.log("[convex.crown] Checking all-complete status", { taskId });
    const task = await ctx.runQuery(internal.tasks.getByIdInternal, {
      id: taskId,
    });
    if (!task) {
      console.error("[convex.crown] Task not found for all-complete check", {
        taskId,
      });
      return jsonResponse({ code: 404, message: "Task not found" }, 404);
    }
    if (
      task.teamId !== workerAuth.payload.teamId ||
      task.userId !== workerAuth.payload.userId
    ) {
      return jsonResponse({ code: 401, message: "Unauthorized" }, 401);
    }

    const runs = await ctx.runQuery(internal.taskRuns.listByTaskInternal, {
      taskId,
    });

    const runsForTeam = runs.filter(
      (run): run is Doc<"taskRuns"> =>
        run.teamId === workerAuth.payload.teamId &&
        run.userId === workerAuth.payload.userId,
    );

    const statuses = runsForTeam.map((run) => ({
      id: run._id,
      status: run.status,
    }));

    const allComplete =
      runsForTeam.length > 0 &&
      runsForTeam.every((run) => run.status === "completed");

    console.log("[convex.crown] All-complete check", {
      taskId,
      totalRuns: runsForTeam.length,
      completedRuns: runsForTeam.filter((r) => r.status === "completed").length,
      allComplete,
      statuses,
    });

    const response = {
      ok: true,
      taskId,
      allComplete,
      statuses,
    } satisfies WorkerAllRunsCompleteResponse;
    return jsonResponse(response);
  }

  // Default crown check logic
  const taskRun = await loadTaskRunForWorker(
    ctx,
    workerAuth,
    validation.data.taskRunId,
  );
  if (taskRun instanceof Response) return taskRun;

  const taskId = (validation.data.taskId ?? taskRun.taskId) as Id<"tasks">;
  if (taskId !== taskRun.taskId) {
    console.warn("[convex.crown] Worker taskId mismatch", {
      providedTaskId: validation.data.taskId,
      expectedTaskId: taskRun.taskId,
    });
    return jsonResponse({ code: 401, message: "Unauthorized" }, 401);
  }

  const task = await ctx.runQuery(internal.tasks.getByIdInternal, {
    id: taskId,
  });
  if (!task) {
    return jsonResponse({ code: 404, message: "Task not found" }, 404);
  }
  if (
    task.teamId !== workerAuth.payload.teamId ||
    task.userId !== workerAuth.payload.userId
  ) {
    console.warn(
      "[convex.crown] Worker attempted to access unauthorized task",
      {
        taskId,
      },
    );
    return jsonResponse({ code: 401, message: "Unauthorized" }, 401);
  }

  const runs = await ctx.runQuery(internal.taskRuns.listByTaskInternal, {
    taskId,
  });

  const workspaceSettings = await ctx.runQuery(
    internal.workspaceSettings.getInternal,
    {
      teamId: workerAuth.payload.teamId,
      userId: workerAuth.payload.userId,
    },
  );

  const runsForTeam = runs.filter(
    (run): run is Doc<"taskRuns"> =>
      run.teamId === workerAuth.payload.teamId &&
      run.userId === workerAuth.payload.userId,
  );

  const allRunsFinished = runsForTeam.every((run) =>
    ["completed", "failed"].includes(run.status),
  );
  const allWorkersReported = runsForTeam.every(
    (run) => run.status === "completed",
  );
  const completedRuns = runsForTeam.filter((run) => run.status === "completed");

  const existingEvaluation = await ctx.runQuery(
    internal.crown.getEvaluationByTaskInternal,
    {
      taskId,
      teamId: workerAuth.payload.teamId,
      userId: workerAuth.payload.userId,
    },
  );

  const shouldEvaluate =
    allRunsFinished &&
    allWorkersReported &&
    completedRuns.length >= 2 &&
    !existingEvaluation;

  const singleRunWinnerId =
    runsForTeam.length === 1 && completedRuns.length === 1
      ? completedRuns[0]._id
      : null;

  const runsPayload = runsForTeam.map((run) => ({
    id: run._id,
    status: run.status as WorkerRunStatus,
    agentName: run.agentName ?? null,
    newBranch: run.newBranch ?? null,
    exitCode: run.exitCode ?? null,
    completedAt: run.completedAt ?? null,
  }));

  const response = {
    ok: true,
    taskId,
    allRunsFinished,
    allWorkersReported,
    shouldEvaluate,
    singleRunWinnerId,
    existingEvaluation: existingEvaluation
      ? {
          winnerRunId: existingEvaluation.winnerRunId,
          evaluatedAt: existingEvaluation.evaluatedAt,
        }
      : null,
    task: {
      text: task.text,
      crownEvaluationError: task.crownEvaluationError ?? null,
      isCompleted: task.isCompleted,
      baseBranch: task.baseBranch ?? null,
      projectFullName: task.projectFullName ?? null,
      autoPrEnabled: workspaceSettings?.autoPrEnabled ?? false,
    },
    runs: runsPayload,
  } satisfies CrownWorkerCheckResponse;
  return jsonResponse(response);
});

export const crownWorkerFinalize = httpAction(async (ctx, req) => {
  const workerAuth = await ensureWorkerAuth(req);
  if (workerAuth instanceof Response) return workerAuth;

  const parsed = await ensureJsonRequest(req);
  if (parsed instanceof Response) return parsed;

  const validation = WorkerFinalizeSchema.safeParse(parsed.json);
  if (!validation.success) {
    console.warn(
      "[convex.crown] Invalid worker finalize payload",
      validation.error,
    );
    return jsonResponse({ code: 400, message: "Invalid input" }, 400);
  }

  const taskId = validation.data.taskId as Id<"tasks">;
  const winnerRunId = validation.data.winnerRunId as Id<"taskRuns">;
  const candidateRunIds = validation.data.candidateRunIds.map(
    (id) => id as Id<"taskRuns">,
  );

  const task = await ctx.runQuery(internal.tasks.getByIdInternal, {
    id: taskId,
  });
  if (!task) {
    return jsonResponse({ code: 404, message: "Task not found" }, 404);
  }
  if (
    task.teamId !== workerAuth.payload.teamId ||
    task.userId !== workerAuth.payload.userId
  ) {
    return jsonResponse({ code: 401, message: "Unauthorized" }, 401);
  }

  const existingEvaluation = await ctx.runQuery(
    internal.crown.getEvaluationByTaskInternal,
    {
      taskId,
      teamId: workerAuth.payload.teamId,
      userId: workerAuth.payload.userId,
    },
  );

  if (existingEvaluation) {
    return jsonResponse({
      ok: true,
      alreadyEvaluated: true,
      winnerRunId: existingEvaluation.winnerRunId,
    });
  }

  try {
    const winningId = await ctx.runMutation(internal.crown.workerFinalize, {
      taskId,
      teamId: workerAuth.payload.teamId,
      userId: workerAuth.payload.userId,
      winnerRunId,
      reason: validation.data.reason,
      summary: validation.data.summary,
      evaluationPrompt: validation.data.evaluationPrompt,
      evaluationResponse: validation.data.evaluationResponse,
      candidateRunIds,
      pullRequest: validation.data.pullRequest,
      pullRequestTitle: validation.data.pullRequestTitle,
      pullRequestDescription: validation.data.pullRequestDescription,
    });

    return jsonResponse({ ok: true, winnerRunId: winningId });
  } catch (error) {
    console.error("[convex.crown] Worker finalize failed", error);
    return jsonResponse({ code: 500, message: "Finalize failed" }, 500);
  }
});

export const crownWorkerComplete = httpAction(async (ctx, req) => {
  console.log("[convex.crown] Worker complete endpoint called", {
    path: req.url,
    method: req.method,
    hasToken: !!req.headers.get("x-cmux-token"),
  });

  const auth = await ensureWorkerAuth(req);
  if (auth instanceof Response) {
    console.error("[convex.crown] Auth failed for worker complete");
    return auth;
  }

  const parsed = await ensureJsonRequest(req);
  if (parsed instanceof Response) return parsed;

  const validation = WorkerCompleteRequestSchema.safeParse(parsed.json);
  if (!validation.success) {
    console.warn(
      "[convex.crown] Invalid worker complete payload",
      validation.error,
    );
    return jsonResponse({ code: 400, message: "Invalid input" }, 400);
  }

  const taskRunId = validation.data.taskRunId as Id<"taskRuns">;
  console.log("[convex.crown] Loading task run for completion", { taskRunId });

  const existingRun = await loadTaskRunForWorker(ctx, auth, taskRunId);
  if (existingRun instanceof Response) {
    console.error("[convex.crown] Failed to load task run", { taskRunId });
    return existingRun;
  }

  console.log("[convex.crown] Marking task run as complete", {
    taskRunId,
    exitCode: validation.data.exitCode,
  });

  await ctx.runMutation(internal.taskRuns.workerComplete, {
    taskRunId,
    exitCode: validation.data.exitCode,
  });

  console.log("[convex.crown] Task run marked as complete successfully", {
    taskRunId,
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
    },
  );

  if (containerSettings?.autoCleanupEnabled) {
    const reviewMinutes = containerSettings.reviewPeriodMinutes ?? 60;
    const scheduledStopAt = containerSettings.stopImmediatelyOnCompletion
      ? Date.now()
      : Date.now() + reviewMinutes * 60 * 1000;

    await ctx.runMutation(internal.taskRuns.updateScheduledStopInternal, {
      taskRunId,
      scheduledStopAt,
    });
  }

  const response = {
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
  } satisfies WorkerTaskRunResponse;
  return jsonResponse(response);
});

export const crownWorkerScheduleStop = httpAction(async (ctx, req) => {
  const auth = await ensureWorkerAuth(req);
  if (auth instanceof Response) return auth;

  const parsed = await ensureJsonRequest(req);
  if (parsed instanceof Response) return parsed;

  const validation = WorkerScheduleRequestSchema.safeParse(parsed.json);
  if (!validation.success) {
    console.warn(
      "[convex.crown] Invalid worker schedule payload",
      validation.error,
    );
    return jsonResponse({ code: 400, message: "Invalid input" }, 400);
  }

  const taskRunId = validation.data.taskRunId as Id<"taskRuns">;
  const existingRun = await loadTaskRunForWorker(ctx, auth, taskRunId);
  if (existingRun instanceof Response) return existingRun;

  await ctx.runMutation(internal.taskRuns.updateScheduledStopInternal, {
    taskRunId,
    scheduledStopAt: validation.data.scheduledStopAt,
  });

  return jsonResponse({ ok: true });
});

// Test endpoint to verify Crown HTTP is working
export const crownHealthCheck = httpAction(async (_ctx, req) => {
  console.log("[convex.crown] Health check endpoint called", {
    path: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  return jsonResponse({
    ok: true,
    service: "crown",
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});
