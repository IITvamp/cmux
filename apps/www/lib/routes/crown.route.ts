import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { stackServerAppJs } from "../utils/stack";
import { verifyTeamAccess } from "@/lib/utils/team-verification";

export const crownRouter = new OpenAPIHono();

// Crown evaluation endpoint using server-side Vercel AI SDK + Anthropic
const EvaluateBody = z.object({
  implementations: z
    .array(
      z.object({
        modelName: z.string(),
        gitDiff: z.string(),
        index: z.number().int(),
      })
    )
    .min(1),
  teamSlugOrId: z.string().optional(),
});

const evaluateRoute = createRoute({
  method: "post",
  path: "/crown/evaluate",
  request: {
    body: {
      content: {
        "application/json": {
          schema: EvaluateBody,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Crown evaluation result",
      content: {
        "application/json": {
          schema: z.object({
            winner: z.number().int().min(0),
            reason: z.string(),
          }),
        },
      },
    },
    400: { description: "Invalid input" },
    401: { description: "Unauthorized" },
    500: { description: "Evaluation failed" },
  },
});

// Summarize endpoint for PR descriptions
const summarizeRoute = createRoute({
  method: "post",
  path: "/crown/summarize",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            prompt: z.string(),
            teamSlugOrId: z.string().optional(),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Summary generated",
      content: {
        "application/json": {
          schema: z.object({
            summary: z.string(),
          }),
        },
      },
    },
    401: { description: "Unauthorized" },
    500: { description: "Summarization failed" },
  },
});

crownRouter.openapi(summarizeRoute, async (c) => {
  try {
    // Check authentication
    const user = await stackServerAppJs.getUser({ tokenStore: c.req.raw });
    if (!user) return c.text("Unauthorized", 401);
    const { accessToken } = await user.getAuthJson();
    if (!accessToken) return c.text("Unauthorized", 401);

    const { prompt, teamSlugOrId } = c.req.valid("json");

    // Verify team access if teamSlugOrId is provided
    if (teamSlugOrId) {
      const team = await verifyTeamAccess({ req: c.req.raw, teamSlugOrId });
      if (!team) return c.text("Unauthorized", 401);
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return c.json(
        { code: 500, message: "Server missing ANTHROPIC_API_KEY" },
        500
      );
    }
    const anthropic = createAnthropic({ apiKey: anthropicKey });

    const { object } = await generateObject({
      model: anthropic("claude-3-5-sonnet-20241022"),
      schema: z.object({ summary: z.string() }),
      system:
        "You are an expert reviewer summarizing pull requests. Provide a clear, concise summary following the requested format.",
      prompt,
      temperature: 0,
      maxRetries: 2,
    });

    return c.json({ summary: object.summary });
  } catch (error) {
    console.error("[crown.summarize] Error:", error);
    return c.json({ code: 500, message: "Summarization failed" }, 500);
  }
});

crownRouter.openapi(evaluateRoute, async (c) => {
  try {
    // Check authentication
    const user = await stackServerAppJs.getUser({ tokenStore: c.req.raw });
    if (!user) return c.text("Unauthorized", 401);
    const { accessToken } = await user.getAuthJson();
    if (!accessToken) return c.text("Unauthorized", 401);

    const evaluationData = c.req.valid("json");
    const { teamSlugOrId } = evaluationData;

    // Verify team access if teamSlugOrId is provided
    if (teamSlugOrId) {
      const team = await verifyTeamAccess({ req: c.req.raw, teamSlugOrId });
      if (!team) return c.text("Unauthorized", 401);
    }

    // Compose prompt from evaluation data
    const evaluationPrompt = `You are evaluating code implementations from different AI models.\n\nHere are the implementations to evaluate:\n${JSON.stringify(
      evaluationData,
      null,
      2
    )}\n\nNOTE: The git diffs shown contain only actual code changes. Lock files, build artifacts, and other non-essential files have been filtered out.\n\nAnalyze these implementations and select the best one based on:\n1. Code quality and correctness\n2. Completeness of the solution\n3. Following best practices\n4. Actually having meaningful code changes (if one has no changes, prefer the one with changes)\n\nRespond with a JSON object containing:\n- \"winner\": the index (0-based) of the best implementation\n- \"reason\": a brief explanation of why this implementation was chosen\n\nExample response:\n{\"winner\": 0, \"reason\": \"Model claude/sonnet-4 provided a more complete implementation with better error handling and cleaner code structure.\"}\n\nIMPORTANT: Respond ONLY with the JSON object, no other text.`;

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return c.json(
        { code: 500, message: "Server missing ANTHROPIC_API_KEY" },
        500
      );
    }
    const anthropic = createAnthropic({ apiKey: anthropicKey });

    const CrownSchema = z.object({
      winner: z.number().int().min(0),
      reason: z.string(),
    });
    const { object } = await generateObject({
      model: anthropic("claude-3-5-haiku-20241022"),
      schema: CrownSchema,
      system:
        "You select the best implementation from structured diff inputs and explain briefly why.",
      prompt: evaluationPrompt,
      temperature: 0,
      maxRetries: 2,
    });

    return c.json(object);
  } catch (error) {
    console.error("[crown.evaluate] Error:", error);
    return c.json({ code: 500, message: "Evaluation failed" }, 500);
  }
});
