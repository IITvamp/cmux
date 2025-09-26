import { verifyTeamAccess } from "@/lib/utils/team-verification";
import { env } from "@/lib/utils/www-env";
import { createAnthropic } from "@ai-sdk/anthropic";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { generateObject } from "ai";
import {
  CrownEvaluationCandidateSchema,
  buildEvaluationPrompt,
  buildSummarizationPrompt,
} from "@cmux/shared/crown/prompts";

const CrownEvaluationRequestSchema = z.object({
  taskText: z.string(),
  candidates: z.array(CrownEvaluationCandidateSchema).min(1),
  teamSlugOrId: z.string().optional(),
});

const CrownEvaluationLLMResponseSchema = z.object({
  winner: z.number().int().min(0),
  reason: z.string(),
});

const CrownEvaluationResponseSchema = CrownEvaluationLLMResponseSchema.extend({
  prompt: z.string(),
});

const CrownSummarizationRequestSchema = z.object({
  taskText: z.string(),
  gitDiff: z.string(),
  teamSlugOrId: z.string().optional(),
});

const CrownSummarizationLLMResponseSchema = z.object({
  summary: z.string(),
});

const CrownSummarizationResponseSchema = CrownSummarizationLLMResponseSchema.extend({
  prompt: z.string(),
});

export const crownRouter = new OpenAPIHono();

const evaluateRoute = createRoute({
  method: "post",
  path: "/crown/evaluate",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CrownEvaluationRequestSchema,
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
          schema: CrownEvaluationResponseSchema,
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
          schema: CrownSummarizationRequestSchema,
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
          schema: CrownSummarizationResponseSchema,
        },
      },
    },
    401: { description: "Unauthorized" },
    500: { description: "Summarization failed" },
  },
});

crownRouter.openapi(summarizeRoute, async (c) => {
  try {
    const { taskText, gitDiff, teamSlugOrId } = c.req.valid("json");
    const stackAuthHeader = c.req.header("x-stack-auth");

    if (stackAuthHeader) {
      const authData = JSON.parse(stackAuthHeader);
      const accessToken = authData?.accessToken;
      if (!accessToken) {
        console.error("[crown.summarize] No access token found");
        return c.text("Unauthorized", 401);
      }
    }

    // Verify team access if provided
    if (teamSlugOrId) {
      try {
        const team = await verifyTeamAccess({ req: c.req.raw, teamSlugOrId });
        if (!team) {
          console.warn(
            "[crown.summarize] Unauthorized: verifyTeamAccess returned null",
            { teamSlugOrId }
          );
          return c.text("Unauthorized", 401);
        }
      } catch (e) {
        console.warn("[crown.summarize] verifyTeamAccess failed", {
          teamSlugOrId,
          error: String(e),
        });
        return c.text("Unauthorized", 401);
      }
    }

    const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

    const prompt = buildSummarizationPrompt(taskText, gitDiff);

    const { object } = await generateObject({
      model: anthropic("claude-opus-4-1-20250805"),
      schema: CrownSummarizationLLMResponseSchema,
      system:
        "You are an expert reviewer summarizing pull requests. Provide a clear, concise summary following the requested format.",
      prompt,
      temperature: 0,
      maxRetries: 2,
    });

    return c.json({ summary: object.summary, prompt });
  } catch (error) {
    console.error("[crown.summarize] Error:", error);
    return c.json({ code: 500, message: "Summarization failed" }, 500);
  }
});

crownRouter.openapi(evaluateRoute, async (c) => {
  try {
    const { taskText, candidates, teamSlugOrId } = c.req.valid("json");
    const stackAuthHeader = c.req.header("x-stack-auth");

    if (stackAuthHeader) {
      const authData = JSON.parse(stackAuthHeader);
      const accessToken = authData?.accessToken;
      if (!accessToken) {
        console.error("[crown.summarize] No access token found");
        return c.text("Unauthorized", 401);
      }
    }

    if (!teamSlugOrId) {
      console.error("[crown.evaluate] Missing teamSlugOrId");
      return c.text("Bad Request", 400);
    }

    // Verify team access (required)
    try {
      const team = await verifyTeamAccess({ req: c.req.raw, teamSlugOrId });
      if (!team) {
        console.warn(
          "[crown.evaluate] Unauthorized: verifyTeamAccess returned null",
          { teamSlugOrId }
        );
        return c.text("Unauthorized", 401);
      }
    } catch (e) {
      console.warn("[crown.evaluate] verifyTeamAccess failed", {
        teamSlugOrId,
        error: String(e),
      });
      return c.text("Unauthorized", 401);
    }

    const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

    const prompt = buildEvaluationPrompt(taskText, candidates);

    const { object } = await generateObject({
      model: anthropic("claude-opus-4-1-20250805"),
      schema: CrownEvaluationLLMResponseSchema,
      system:
        "You select the best implementation from structured diff inputs and explain briefly why.",
      prompt,
      temperature: 0,
      maxRetries: 2,
    });

    return c.json({ ...object, prompt });
  } catch (error) {
    console.error("[crown.evaluate] Error:", error);
    return c.json({ code: 500, message: "Evaluation failed" }, 500);
  }
});
