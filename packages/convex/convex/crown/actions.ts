"use node";

import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { ConvexError, v } from "convex/values";
import { z } from "zod";
import { env } from "../../_shared/convex-env";
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

export const evaluateRuns = action({
  args: {
    taskId: v.id("tasks"),
    taskPrompt: v.string(),
    runs: v.array(
      v.object({
        id: v.string(),
        agentName: v.string(),
        summary: v.string(),
        diff: v.string(),
      })
    ),
  },
  handler: async (_ctx, args) => {
    const apiKey = env.ANTHROPIC_API_KEY;

    // Build evaluation prompt
    const evaluationPrompt = `You are evaluating multiple implementations of the following task:

Task Prompt:
${args.taskPrompt}

${args.runs.map((run, idx) => `
=== Implementation ${idx} (${run.agentName}) ===
ID: ${run.id}
Summary: ${run.summary}

Diff:
${run.diff}
`).join('\n')}

Select the best implementation based on:
1. Correctness and completeness of the solution
2. Code quality and best practices
3. How well it addresses the original task requirements

Return the index (0-based) of the best implementation.`;

    try {
      const result = await performCrownEvaluation(apiKey, evaluationPrompt);

      // Map index to run ID
      const winnerRun = args.runs[result.winner];
      if (!winnerRun) {
        throw new ConvexError(`Invalid winner index: ${result.winner}`);
      }

      return {
        winnerId: winnerRun.id,
        reason: result.reason,
        evaluationPrompt,
        evaluationResponse: JSON.stringify(result),
        llmReasoningTrace: {
          model: MODEL_NAME,
          winner: result.winner,
          reason: result.reason,
        },
      };
    } catch (error) {
      console.error("[convex.crown] Evaluation failed", error);
      return {
        winnerId: null,
        error: error instanceof Error ? error.message : "Unknown error",
        evaluationPrompt,
      };
    }
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
