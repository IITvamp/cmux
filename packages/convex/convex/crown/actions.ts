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
  taskText: string,
  candidates: Array<{
    modelName: string;
    gitDiff: string;
    index: number;
  }>,
): Promise<CrownEvaluationResponse> {
  const anthropic = createAnthropic({ apiKey });

  const evaluationData = {
    task: taskText,
    implementations: candidates,
  };

  const prompt = `You are evaluating code implementations from different AI models.

Here are the implementations to evaluate:
${JSON.stringify(evaluationData, null, 2)}

NOTE: The git diffs shown contain only actual code changes. Lock files, build artifacts, and other non-essential files have been filtered out.

Analyze these implementations and select the best one based on:
1. Code quality and correctness
2. Completeness of the solution
3. Following best practices
4. Actually having meaningful code changes (if one has no changes, prefer the one with changes)

Respond with a JSON object containing:
- "winner": the index (0-based) of the best implementation
- "reason": a brief explanation of why this implementation was chosen

Example response:
{"winner": 0, "reason": "Model claude/sonnet-4 provided a more complete implementation with better error handling and cleaner code structure."}

IMPORTANT: Respond ONLY with the JSON object, no other text.`;

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
  taskText: string,
  gitDiff: string,
): Promise<CrownSummarizationResponse> {
  const anthropic = createAnthropic({ apiKey });

  const prompt = `You are an expert reviewer summarizing a pull request.

GOAL
- Explain succinctly what changed and why.
- Call out areas the user should review carefully.
- Provide a quick test plan to validate the changes.

CONTEXT
- User's original request:
${taskText}
- Relevant diffs (unified):
${gitDiff || "<no code changes captured>"}

INSTRUCTIONS
- Base your summary strictly on the provided diffs and request.
- Be specific about files and functions when possible.
- Prefer clear bullet points over prose. Keep it under ~300 words.
- If there are no code changes, say so explicitly and suggest next steps.

OUTPUT FORMAT (Markdown)
## PR Review Summary
- What Changed: bullet list
- Review Focus: bullet list (risks/edge cases)
- Test Plan: bullet list of practical steps
- Follow-ups: optional bullets if applicable
`;

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
    taskText: v.string(),
    candidates: v.array(
      v.object({
        modelName: v.string(),
        gitDiff: v.string(),
        index: v.number(),
      }),
    ),
    teamSlugOrId: v.string(),
  },
  handler: async (_ctx, args) => {
    // Get the API key for this team
    const apiKey = env.ANTHROPIC_API_KEY;

    // Perform the evaluation
    return performCrownEvaluation(apiKey, args.taskText, args.candidates);
  },
});

export const summarize = action({
  args: {
    taskText: v.string(),
    gitDiff: v.string(),
    teamSlugOrId: v.string(),
  },
  handler: async (_ctx, args) => {
    // Get the API key for this team
    const apiKey = env.ANTHROPIC_API_KEY;

    // Perform the summarization
    return performCrownSummarization(apiKey, args.taskText, args.gitDiff);
  },
});
