import { env } from "../_shared/convex-env";
import { httpAction } from "./_generated/server";

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) {
    res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return res === 0;
}

async function verifySignature(
  secret: string,
  payload: string,
  signatureHeader: string | null
): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expectedHex = signatureHeader.slice("sha256=".length).toLowerCase();
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const computedHex = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toLowerCase();
  return safeEqualHex(computedHex, expectedHex);
}

export const githubWebhook = httpAction(async (_ctx, req) => {
  if (!env.GITHUB_APP_WEBHOOK_SECRET) {
    return new Response("webhook not configured", { status: 501 });
  }
  const payload = await req.text();
  const event = req.headers.get("x-github-event");
  const signature = req.headers.get("x-hub-signature-256");

  if (!(await verifySignature(env.GITHUB_APP_WEBHOOK_SECRET, payload, signature))) {
    return new Response("invalid signature", { status: 400 });
  }

  try {
    JSON.parse(payload);
  } catch {
    return new Response("invalid payload", { status: 400 });
  }

  // Note: we intentionally avoid direct DB access in httpAction.
  // Event persistence/backfill is handled by the Node server using installation tokens.

  // Handle ping quickly
  if (event === "ping") {
    return new Response("pong", { status: 200 });
  }

  try {
    // Accept all events; processing is handled outside Convex to avoid actions.
  } catch (_err) {
    // Swallow errors to avoid GitHub retries while we iterate
  }

  return new Response("ok", { status: 200 });
});
