'use node';

import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { ConvexError, v } from "convex/values";
import { z } from "zod";
import { api } from "../_generated/api";
import { action, type ActionCtx } from "../_generated/server";
import { env } from "../../_shared/convex-env";

const MODEL_NAME = "claude-opus-4-1-20250805";

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

function requireAnthropicApiKey(): string {
  if (!env.ANTHROPIC_API_KEY) {
    console.error("[convex.crown] Missing ANTHROPIC_API_KEY env");
    throw new ConvexError("Anthropic provider is not configured");
  }
  return env.ANTHROPIC_API_KEY;
}

async function ensureTeamMembership(
  ctx: ActionCtx,
  teamSlugOrId: string,
  userId: string
): Promise<void> {
  const team = await ctx.runQuery(api.teams.get, { teamSlugOrId });
  if (!team) {
    console.warn("[convex.crown] Team not found", { teamSlugOrId });
    throw new ConvexError("Unauthorized");
  }

  const memberships = await ctx.runQuery(api.teams.listTeamMemberships, {});
  const hasMembership = memberships.some((membership) => {
    return membership.teamId === team.uuid;
  });

  if (!hasMembership) {
    console.warn("[convex.crown] User missing membership", {
      teamSlugOrId,
      userId,
    });
    throw new ConvexError("Unauthorized");
  }
}

export async function performCrownEvaluation(
  prompt: string
): Promise<CrownEvaluationResponse> {
  const anthropic = createAnthropic({ apiKey: requireAnthropicApiKey() });

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
  prompt: string
): Promise<CrownSummarizationResponse> {
  const anthropic = createAnthropic({ apiKey: requireAnthropicApiKey() });

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
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthorized");
    }

    await ensureTeamMembership(ctx, args.teamSlugOrId, identity.subject);
    return performCrownEvaluation(args.prompt);
  },
});

export const summarize = action({
  args: {
    prompt: v.string(),
    teamSlugOrId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthorized");
    }

    if (args.teamSlugOrId) {
      await ensureTeamMembership(ctx, args.teamSlugOrId, identity.subject);
    }

    return performCrownSummarization(args.prompt);
  },
});
