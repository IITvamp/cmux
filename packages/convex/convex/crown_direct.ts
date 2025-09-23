import { z } from "zod";
import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

const JSON_HEADERS = { "content-type": "application/json" } as const;

const DirectCrownEvaluationRequestSchema = z.object({
  taskId: z.string(),
  completedRunIds: z.array(z.string()),
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

export const directCrownEvaluate = httpAction(async (ctx, req) => {
  // Parse request
  const parsed = await ensureJsonRequest(req);
  if (parsed instanceof Response) return parsed;

  const validation = DirectCrownEvaluationRequestSchema.safeParse(parsed.json);
  if (!validation.success) {
    console.warn("[convex.crown_direct] Invalid evaluation payload", validation.error);
    return jsonResponse({ code: 400, message: "Invalid input" }, 400);
  }

  const { taskId, completedRunIds } = validation.data;

  try {
    // Get task details directly from DB
    const task = await ctx.runQuery(api.crown_workflow.getTaskById, {
      taskId: taskId as Id<"tasks">
    });

    if (!task) {
      console.warn("[convex.crown_direct] Task not found", { taskId });
      return jsonResponse({ code: 404, message: "Task not found" }, 404);
    }

    // Get all task runs directly from DB
    const taskRuns = await ctx.runQuery(api.crown_workflow.getTaskRunsByIds, {
      runIds: completedRunIds as Id<"taskRuns">[]
    });

    if (taskRuns.length < 2) {
      console.warn("[convex.crown_direct] Not enough runs for evaluation", {
        taskId,
        runCount: taskRuns.length,
      });
      return jsonResponse(
        { code: 400, message: "Need at least 2 runs for crown evaluation" },
        400
      );
    }

    // For now, we'll use summaries instead of actual git diffs
    // In a production system, you'd want to collect actual diffs
    const runDiffs: Record<string, string> = {};
    for (const run of taskRuns) {
      // Use the run summary or a placeholder
      runDiffs[run._id] = run.summary || `Task completed by ${run.agentName || 'agent'}`;
    }

    // Prepare evaluation context
    const evaluationContext = {
      taskPrompt: task.prompt,
      runs: taskRuns.map(run => ({
        id: run._id,
        agentName: run.agentName || "Unknown",
        summary: run.summary || "",
        diff: runDiffs[run._id] || "No diff available",
      })),
    };

    // Call the crown evaluation action
    const evaluationResult = await ctx.runAction(api.crown.actions.evaluateRuns, {
      taskId: taskId as Id<"tasks">,
      taskPrompt: task.prompt,
      runs: evaluationContext.runs,
    });

    if (!evaluationResult.winnerId) {
      // Evaluation failed - mark task with error
      await ctx.runMutation(api.crown_workflow.failCrownEvaluation, {
        taskId: taskId as Id<"tasks">,
        error: evaluationResult.error || "Failed to determine winner",
      });

      return jsonResponse(
        { code: 500, message: "Failed to determine winner" },
        500
      );
    }

    // Create crown evaluation record
    const evaluationId = await ctx.runMutation(api.crown_workflow.createCrownEvaluation, {
      taskId: taskId as Id<"tasks">,
      winnerRunId: evaluationResult.winnerId as Id<"taskRuns">,
      candidateRunIds: completedRunIds as Id<"taskRuns">[],
      evaluationPrompt: evaluationResult.evaluationPrompt || "",
      evaluationResponse: evaluationResult.evaluationResponse || "",
      llmReasoningTrace: evaluationResult.llmReasoningTrace,
    });

    // Mark the winner and complete the task
    await ctx.runMutation(api.crown_workflow.completeCrownEvaluation, {
      taskId: taskId as Id<"tasks">,
      winnerRunId: evaluationResult.winnerId as Id<"taskRuns">,
      reason: evaluationResult.reason || "Selected by crown evaluation",
      evaluationId,
    });

    return jsonResponse({
      success: true,
      winnerId: evaluationResult.winnerId,
      reason: evaluationResult.reason,
      evaluationId,
    });
  } catch (error) {
    console.error("[convex.crown_direct] Evaluation error", error);

    // Mark task with error
    try {
      await ctx.runMutation(api.crown_workflow.failCrownEvaluation, {
        taskId: taskId as Id<"tasks">,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } catch (mutationError) {
      console.error("[convex.crown_direct] Failed to mark task with error", mutationError);
    }

    return jsonResponse({ code: 500, message: "Evaluation failed" }, 500);
  }
});