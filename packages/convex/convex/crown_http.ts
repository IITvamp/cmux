import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { env } from "../_shared/convex-env";
import { jwtVerify, type JWTPayload } from "jose";

type EvaluateBody = {
  prompt: string;
};

type CrownEvaluationResponse = {
  winner: number;
  reason: string;
};

async function readJson(req: Request): Promise<unknown> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Response("Unsupported Media Type", { status: 415 });
  }
  try {
    return await req.json();
  } catch {
    throw new Response("Invalid JSON", { status: 400 });
  }
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export const crownEvaluateHttp = httpAction(async (ctx, req) => {
  // 1) Parse and validate body
  const bodyUnknown = await readJson(req);
  if (!isRecord(bodyUnknown) || typeof bodyUnknown.prompt !== "string") {
    return new Response("Invalid body: missing prompt", { status: 400 });
  }
  const body = bodyUnknown as EvaluateBody;

  // 2) Verify Bearer token (task run JWT issued by Convex)
  const token = getBearerToken(req);
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: JWTPayload & { teamId?: string; userId?: string };
  try {
    const verified = await jwtVerify(
      token,
      new TextEncoder().encode(env.CMUX_TASK_RUN_JWT_SECRET)
    );
    payload = verified.payload as JWTPayload & {
      teamId?: string;
      userId?: string;
    };
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const teamId = typeof payload.teamId === "string" ? payload.teamId : null;
  const userId = typeof payload.userId === "string" ? payload.userId : null;
  if (!teamId || !userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 3) Load Anthropic API key for this team/user from Convex
  const apiKeyDoc = await ctx.runQuery(
    internal.apiKeys.internalGetByEnvVarForTeamUser,
    {
      teamId,
      userId,
      envVar: "ANTHROPIC_API_KEY",
    }
  );

  const anthropicApiKey = apiKeyDoc?.value;
  if (!anthropicApiKey || anthropicApiKey.trim().length === 0) {
    return new Response("Missing Anthropic API key", { status: 400 });
  }

  // 4) Call Anthropic Messages API directly
  // Using Claude 3.5 Sonnet for structured JSON response
  const systemPrompt =
    "You select the best implementation from structured diff inputs and explain briefly why.";
  const anthropicReq = {
    model: "claude-3-5-sonnet-20240620",
    max_tokens: 512,
    temperature: 0,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: body.prompt,
      },
    ],
  } as const;

  let textOut = "";
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(anthropicReq),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(
        `Anthropic error: ${resp.status} ${resp.statusText} ${errText}`,
        { status: 502 }
      );
    }
    const data = (await resp.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    textOut = data.content?.[0]?.text ?? "";
  } catch (err) {
    return new Response(`Anthropic request failed: ${String(err)}`, {
      status: 502,
    });
  }

  // 5) Parse model output as JSON
  try {
    const parsed = JSON.parse(textOut) as CrownEvaluationResponse;
    if (
      typeof parsed.winner === "number" &&
      typeof parsed.reason === "string"
    ) {
      return new Response(JSON.stringify(parsed), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
  } catch {
    // fall-through
  }

  // If parsing fails, return a safe error
  return new Response(
    JSON.stringify({ code: 500, message: "Evaluation failed" }),
    { status: 500, headers: { "content-type": "application/json" } }
  );
});

