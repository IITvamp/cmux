import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { z } from "zod";
import { env } from "../_shared/convex-env";

// Authentication helper to verify API key
async function verifyApiKey(apiKey: string | null): Promise<boolean> {
  if (!apiKey || !env.CROWN_API_KEY) {
    return false;
  }
  return apiKey === env.CROWN_API_KEY;
}

export const evaluate = httpAction(async (ctx, request: Request) => {
  try {
    // Check authentication
    const apiKey = request.headers.get("x-api-key");
    if (!await verifyApiKey(apiKey)) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { prompt, teamSlugOrId, taskId } = body as {
      prompt: string;
      teamSlugOrId: string;
      taskId: Id<"tasks">;
    };

    if (!prompt || !teamSlugOrId || !taskId) {
      return new Response("Missing required fields", { status: 400 });
    }

    // Use Anthropic for evaluation
    const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

    const schema = z.object({
      winner: z.number().int().min(0),
      reason: z.string(),
    });

    const { object } = await generateObject({
      model: anthropic("claude-opus-4-1-20250805"),
      schema,
      system:
        "You select the best implementation from structured diff inputs and explain briefly why.",
      prompt,
      temperature: 0,
      maxRetries: 2,
    });

    return new Response(JSON.stringify(object), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[crown_http.evaluate] Error:", error);
    return new Response(
      JSON.stringify({ error: "Evaluation failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

export const summarize = httpAction(async (ctx, request: Request) => {
  try {
    // Check authentication
    const apiKey = request.headers.get("x-api-key");
    if (!await verifyApiKey(apiKey)) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { prompt } = body as { prompt: string };

    if (!prompt) {
      return new Response("Missing prompt", { status: 400 });
    }

    // Use Anthropic for summarization
    const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

    const schema = z.object({ summary: z.string() });

    const { object } = await generateObject({
      model: anthropic("claude-opus-4-1-20250805"),
      schema,
      system:
        "You are an expert reviewer summarizing pull requests. Provide a clear, concise summary following the requested format.",
      prompt,
      temperature: 0,
      maxRetries: 2,
    });

    return new Response(
      JSON.stringify({ summary: object.summary }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[crown_http.summarize] Error:", error);
    return new Response(
      JSON.stringify({ error: "Summarization failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});