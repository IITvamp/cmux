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
    teamSlugOrId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get all task runs for this task
    const taskRuns = await ctx.runQuery(api.taskRuns.getByTask, {
      taskId: args.taskId,
      teamSlugOrId: args.teamSlugOrId,
    });

    // Filter only completed runs
    const completedRuns = taskRuns.filter(run => run.status === "completed");

    if (completedRuns.length === 0) {
      console.log(`[convex.crown] No completed runs for task ${args.taskId}`);
      return { evaluated: false, reason: "No completed runs" };
    }

    if (completedRuns.length === 1) {
      console.log(`[convex.crown] Only one completed run for task ${args.taskId}, skipping crown`);
      // Mark the single run as crowned
      await ctx.runMutation(api.crown.mutations.markRunAsCrowned, {
        taskRunId: completedRuns[0]._id,
        reason: "Single successful run - automatically crowned",
      });
      return { evaluated: true, winner: completedRuns[0]._id, reason: "Single successful run" };
    }

    // Get task details
    const task = await ctx.runQuery(api.tasks.get, {
      teamSlugOrId: args.teamSlugOrId,
      id: args.taskId,
    });

    if (!task) {
      console.error(`[convex.crown] Task ${args.taskId} not found`);
      return { evaluated: false, reason: "Task not found" };
    }

    // Prepare evaluation prompt with all completed runs
    const runDetails = completedRuns.map((run, index) => ({
      index,
      id: run._id,
      agentName: run.agentName || "Unknown Agent",
      summary: run.summary || "No summary available",
      branch: run.newBranch || "No branch",
    }));

    const evaluationPrompt = `
Task: ${task.description}

${runDetails.map(run => `
Run ${run.index}:
Agent: ${run.agentName}
Branch: ${run.branch}
Summary: ${run.summary}
`).join("\n")}

Please evaluate all runs and select the best implementation.
Return the index (0-based) of the winning run and explain your reasoning.
`;

    try {
      // Perform crown evaluation
      const result = await performCrownEvaluation(env.ANTHROPIC_API_KEY, evaluationPrompt);

      if (result.winner >= 0 && result.winner < completedRuns.length) {
        const winnerRun = completedRuns[result.winner];

        // Mark the winner as crowned
        await ctx.runMutation(api.crown.mutations.markRunAsCrowned, {
          taskRunId: winnerRun._id,
          reason: result.reason,
        });

        // Store crown evaluation record
        await ctx.runMutation(api.crown.mutations.recordEvaluation, {
          taskId: args.taskId,
          winnerRunId: winnerRun._id,
          candidateRunIds: completedRuns.map(r => r._id),
          evaluationPrompt,
          evaluationResponse: JSON.stringify(result),
          teamId: args.teamSlugOrId,
        });

        return {
          evaluated: true,
          winner: winnerRun._id,
          reason: result.reason
        };
      } else {
        console.error(`[convex.crown] Invalid winner index: ${result.winner}`);
        return { evaluated: false, reason: "Invalid evaluation result" };
      }
    } catch (error) {
      console.error(`[convex.crown] Failed to evaluate task ${args.taskId}`, error);
      return { evaluated: false, reason: "Evaluation failed" };
    }
  },
});
