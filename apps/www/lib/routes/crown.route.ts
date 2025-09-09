import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { verifyTeamAccess } from "@/lib/utils/team-verification";

const CrownEvaluationRequestSchema = z.object({
  prompt: z.string(),
  teamSlugOrId: z.string(),
});

const CrownEvaluationResponseSchema = z.object({
  winner: z.number().int().min(0),
  reason: z.string(),
});

const CrownSummarizationRequestSchema = z.object({
  prompt: z.string(),
  teamSlugOrId: z.string().optional(),
});

const CrownSummarizationResponseSchema = z.object({
  summary: z.string(),
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
    const { prompt, teamSlugOrId } = c.req.valid("json");
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

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return c.json(
        { code: 500, message: "Server missing ANTHROPIC_API_KEY" },
        500
      );
    }
    const anthropic = createAnthropic({ apiKey: anthropicKey });

    const { object } = await generateObject({
      model: anthropic("claude-opus-4-1-20250805"),
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
    const { prompt, teamSlugOrId } = c.req.valid("json");
    const stackAuthHeader = c.req.header("x-stack-auth");

    if (stackAuthHeader) {
      const authData = JSON.parse(stackAuthHeader);
      const accessToken = authData?.accessToken;
      if (!accessToken) {
        console.error("[crown.summarize] No access token found");
        return c.text("Unauthorized", 401);
      }
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

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return c.json(
        { code: 500, message: "Server missing ANTHROPIC_API_KEY" },
        500
      );
    }
    const anthropic = createAnthropic({ apiKey: anthropicKey });

    const { object } = await generateObject({
      model: anthropic("claude-opus-4-1-20250805"),
      schema: CrownEvaluationResponseSchema,
      system:
        "You select the best implementation from structured diff inputs and explain briefly why.",
      prompt,
      temperature: 0,
      maxRetries: 2,
    });

    return c.json(object);
  } catch (error) {
    console.error("[crown.evaluate] Error:", error);
    return c.json({ code: 500, message: "Evaluation failed" }, 500);
  }
});
