"use node";

import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { ConvexError, v } from "convex/values";
import { z } from "zod";
import { env } from "../../_shared/convex-env";
import { api } from "../_generated/api";
import { action } from "../_generated/server";

const MODEL_NAME = "claude-3-5-sonnet-20241022";

export const CrownEvaluationResponseSchema = z.object({
  winner: z.number().int().min(0),
  reason: z.string(),
});

export type CrownEvaluationResponse = z.infer<
  typeof CrownEvaluationResponseSchema
>;

export const CrownSummarizationResponseSchema = z.object({
  summary: z.string(),
});

export type CrownSummarizationResponse = z.infer<
  typeof CrownSummarizationResponseSchema
>;

export async function performCrownEvaluation(
  apiKey: string,
  prompt: string
): Promise<CrownEvaluationResponse> {
  const anthropic = createAnthropic({ apiKey });

  try {
    const { object } = await generateObject({
      model: anthropic(MODEL_NAME),
      schema: CrownEvaluationResponseSchema,
      system:
        "You select the best implementation from structured diff inputs and explain briefly why.",
      prompt,
      temperature: 0,
      maxRetries: 2,
    });

    return CrownEvaluationResponseSchema.parse(object);
  } catch (error) {
    console.error("[convex.crown] Evaluation error", error);
    throw new ConvexError("Evaluation failed");
  }
}

export async function performCrownSummarization(
  apiKey: string,
  prompt: string
): Promise<CrownSummarizationResponse> {
  const anthropic = createAnthropic({ apiKey });

  try {
    const { object } = await generateObject({
      model: anthropic(MODEL_NAME),
      schema: CrownSummarizationResponseSchema,
      system:
        "You are an expert reviewer summarizing pull requests. Provide a clear, concise summary following the requested format.",
      prompt,
      temperature: 0,
      maxRetries: 2,
    });

    return CrownSummarizationResponseSchema.parse(object);
  } catch (error) {
    console.error("[convex.crown] Summarization error", error);
    throw new ConvexError("Summarization failed");
  }
}

export const evaluate = action({
  args: {
    prompt: v.string(),
    teamSlugOrId: v.string(),
  },
  handler: async (_ctx, args) => {
    // Get the API key for this team
    const apiKey = env.ANTHROPIC_API_KEY;

    // Perform the evaluation
    return performCrownEvaluation(apiKey, args.prompt);
  },
});

export const summarize = action({
  args: {
    prompt: v.string(),
    teamSlugOrId: v.string(),
  },
  handler: async (_ctx, args) => {
    // Get the API key for this team
    const apiKey = env.ANTHROPIC_API_KEY;

    // Perform the summarization
    return performCrownSummarization(apiKey, args.prompt);
  },
});

// Action to evaluate task runs when all are complete
export const evaluateTaskRuns = action({
  args: {
    taskId: v.id("tasks"),
    teamSlugOrId: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    // Get all task runs for this task
    const taskRuns = await ctx.runQuery(api.taskRuns.checkAllTaskRunsComplete, {
      taskId: args.taskId,
    });

    if (!taskRuns.hasRuns || !taskRuns.hasSuccessful) {
      console.log("[convex.crown] No successful runs to evaluate");
      return { evaluated: false, reason: "No successful runs" };
    }

    if (!taskRuns.allComplete) {
      console.log("[convex.crown] Not all runs complete yet");
      return { evaluated: false, reason: "Not all runs complete" };
    }

    // Get the task details
    const task = await ctx.runQuery(api.tasks.getById, {
      teamSlugOrId: args.teamSlugOrId,
      id: args.taskId,
    });

    if (!task) {
      console.error("[convex.crown] Task not found");
      return { evaluated: false, reason: "Task not found" };
    }

    // Get all successful task runs with their details
    const allRuns: any[] = await ctx.runQuery(api.taskRuns.getByTask, {
      teamSlugOrId: args.teamSlugOrId,
      taskId: args.taskId,
    });

    // Filter only completed runs
    const completedRuns = allRuns.filter((run: any) => run.status === "completed");

    if (completedRuns.length === 0) {
      return { evaluated: false, reason: "No completed runs to evaluate" };
    }

    if (completedRuns.length === 1) {
      // Only one successful run, automatically crown it
      const winnerRun = completedRuns[0];
      await ctx.runMutation(api.crown.setCrownWinner, {
        teamSlugOrId: args.teamSlugOrId,
        taskRunId: winnerRun._id,
        reason: "Single successful implementation",
      });
      return { evaluated: true, winnerId: winnerRun._id };
    }

    // Build evaluation prompt
    const evaluationPrompt = buildEvaluationPrompt(task, completedRuns);

    try {
      // Perform crown evaluation
      const result = await performCrownEvaluation(env.ANTHROPIC_API_KEY, evaluationPrompt);

      // Crown the winner
      if (result.winner >= 0 && result.winner < completedRuns.length) {
        const winnerRun = completedRuns[result.winner];
        await ctx.runMutation(api.crown.setCrownWinner, {
          teamSlugOrId: args.teamSlugOrId,
          taskRunId: winnerRun._id,
          reason: result.reason,
        });
        return { evaluated: true, winnerId: winnerRun._id, reason: result.reason };
      }
    } catch (error) {
      console.error("[convex.crown] Failed to evaluate task runs", error);
      // Mark task with evaluation error
      await ctx.runMutation(api.tasks.updateCrownEvaluationError, {
        taskId: args.taskId,
        error: error instanceof Error ? error.message : "Evaluation failed",
      });
      return { evaluated: false, reason: "Evaluation failed", error };
    }

    return { evaluated: false, reason: "Unknown error" };
  },
});

function buildEvaluationPrompt(task: any, runs: any[]): string {
  return `Evaluate the following task implementations and select the best one.

Task: ${task.text}
${task.description ? `Description: ${task.description}` : ""}

Implementations:
${runs
  .map(
    (run, index) => `
Option ${index}:
Agent: ${run.agentName || "Unknown"}
Summary: ${run.summary || "No summary available"}
Exit Code: ${run.exitCode || 0}
Completed At: ${new Date(run.completedAt || 0).toISOString()}
`
  )
  .join("\n")}

Select the implementation that best fulfills the task requirements. Return the index (0-based) of the best implementation.`;
}
