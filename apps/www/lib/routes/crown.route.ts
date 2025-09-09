import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { verifyTeamAccess } from "@/lib/utils/team-verification";
import { stackServerAppJs } from "../utils/stack";

export const crownRouter = new OpenAPIHono();

const evaluateRoute = createRoute({
  method: "post",
  path: "/crown/evaluate",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            prompt: z.string(),
            teamSlugOrId: z.string(),
          }),
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
    const user = await stackServerAppJs.getUser({ tokenStore: c.req.raw });
    if (!user) {
      return c.text("Unauthorized", 401);
    }
    const { accessToken } = await user.getAuthJson();
    if (!accessToken) return c.text("Unauthorized", 401);

    const { prompt, teamSlugOrId } = c.req.valid("json");

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
    const user = await stackServerAppJs.getUser({ tokenStore: c.req.raw });
    if (!user) {
      return c.text("Unauthorized", 401);
    }
    const { accessToken } = await user.getAuthJson();
    if (!accessToken) return c.text("Unauthorized", 401);

    const { prompt, teamSlugOrId } = c.req.valid("json");

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

    const CrownSchema = z.object({
      winner: z.number().int().min(0),
      reason: z.string(),
    });

    const { object } = await generateObject({
      model: anthropic("claude-opus-4-1-20250805"),
      schema: CrownSchema,
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
