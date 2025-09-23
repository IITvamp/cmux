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

export const evaluateTask = action({
  args: {
    taskId: v.id("tasks"),
    teamId: v.string(),
  },
  handler: async (ctx, args): Promise<string | null> => {
    // Get the task
    const task = await ctx.runQuery(api.tasks.getByIdInternal, { id: args.taskId });
    if (!task || task.teamId !== args.teamId) {
      throw new Error("Task not found or unauthorized");
    }

    // Get all completed runs for this task
    const taskRuns = await ctx.runQuery(api.taskRuns.getAllTaskRunsForTask, {
      taskId: args.taskId,
    });

    const completedRuns = taskRuns.filter((run: any) => run.status === "completed");

    if (completedRuns.length === 0) {
      console.log("[Crown] No completed runs for task", args.taskId);
      return null;
    }

    if (completedRuns.length === 1) {
      // Only one model completed - crown it automatically
      await ctx.runMutation(api.taskRuns.setCrownWinner, {
        taskRunId: completedRuns[0]._id,
        reason: "Only one model completed the task",
      });
      return completedRuns[0]._id;
    }

    // Build evaluation prompt
    const evaluationPrompt = `You are evaluating ${completedRuns.length} implementations for the following task:\n\n${task.text}\n\n`;
    // TODO: Add diffs and implementation details to the prompt

    try {
      // Get the API key
      const apiKey = env.ANTHROPIC_API_KEY;

      // Perform the evaluation
      const evaluation = await performCrownEvaluation(apiKey, evaluationPrompt);

      // Select winner based on evaluation
      const winnerIndex = Math.min(evaluation.winner, completedRuns.length - 1);
      const winner = completedRuns[winnerIndex];

      // Mark the winner
      await ctx.runMutation(api.taskRuns.setCrownWinner, {
        taskRunId: winner._id,
        reason: evaluation.reason,
      });

      // Store the evaluation
      await ctx.runMutation(api.crown.storeEvaluation, {
        taskId: args.taskId,
        winnerRunId: winner._id,
        candidateRunIds: completedRuns.map((run: any) => run._id),
        evaluationPrompt,
        evaluationResponse: JSON.stringify(evaluation),
        teamId: args.teamId,
        userId: task.userId,
      });

      return winner._id;
    } catch (error) {
      console.error("[Crown] Evaluation failed for task", args.taskId, error);
      // Mark task with evaluation error
      await ctx.runMutation(api.tasks.updateCrownEvaluationError, {
        taskId: args.taskId,
        error: error instanceof Error ? error.message : "Evaluation failed",
      });
      throw error;
    }
  },
});
