import { env } from "../_shared/convex-env";
import {
  base64urlFromBytes,
  base64urlToBytes,
  bytesToHex,
} from "../_shared/encoding";
import { hmacSha256, safeEqualHex } from "../_shared/crypto";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

export const githubSetup = httpAction(async (ctx, req) => {
  const url = new URL(req.url);
  const installationIdStr = url.searchParams.get("installation_id");
  const state = url.searchParams.get("state");
  const base = env.BASE_APP_URL.replace(/\/$/, "");

  if (!installationIdStr) {
    return new Response("missing params", { status: 400 });
  }
  const installationId = Number(installationIdStr);
  if (!Number.isFinite(installationId)) {
    return new Response("invalid installation_id", { status: 400 });
  }

  // If state is missing (e.g. user used "Configure" from GitHub settings),
  // try to resolve the target team from an existing connection and redirect.
  if (!state) {
    const existing = await ctx.runQuery(
      internal.github_app.getProviderConnectionByInstallationId,
      { installationId }
    );
    if (existing && existing.teamId) {
      const team = await ctx.runQuery(internal.teams.getByTeamIdInternal, {
        teamId: existing.teamId,
      });
      const teamPath = team?.slug ?? existing.teamId;
      const target = `${base}/${encodeURIComponent(teamPath)}/connect-complete`;
      return Response.redirect(target, 302);
    }
    // Fallback: send user to team picker if we can't resolve a team
    return Response.redirect(`${base}/team-picker`, 302);
  }

  if (!env.INSTALL_STATE_SECRET) {
    return new Response("setup not configured", { status: 501 });
  }

  // Parse token: v1.<payload>.<sig>
  const parts = state.split(".");
  if (parts.length !== 3) return new Response("invalid state", { status: 400 });
  let payloadStr = "";
  const version = parts[0];

  if (version === "v2") {
    const payloadBytes = base64urlToBytes(parts[1] ?? "");
    payloadStr = new TextDecoder().decode(payloadBytes);
    const expectedSigB64 = parts[2] ?? "";
    const sigBuf = await hmacSha256(env.INSTALL_STATE_SECRET, payloadStr);
    const actualSigB64 = base64urlFromBytes(sigBuf);
    if (actualSigB64 !== expectedSigB64) {
      return new Response("invalid signature", { status: 400 });
    }
  } else if (version === "v1") {
    payloadStr = decodeURIComponent(parts[1] ?? "");
    const expectedSigHex = parts[2] ?? "";
    const sigBuf = await hmacSha256(env.INSTALL_STATE_SECRET, payloadStr);
    const actualSigHex = bytesToHex(sigBuf);
    if (!safeEqualHex(actualSigHex, expectedSigHex)) {
      return new Response("invalid signature", { status: 400 });
    }
  } else {
    return new Response("invalid state", { status: 400 });
  }

  type Payload = {
    ver: 1;
    teamId: string;
    userId: string;
    iat: number;
    exp: number;
    nonce: string;
    ui?: string;
  };
  let payload: Payload;
  try {
    payload = JSON.parse(payloadStr) as Payload;
  } catch {
    return new Response("invalid payload", { status: 400 });
  }

  const now = Date.now();
  if (payload.exp < now) {
    await ctx.runMutation(internal.github_app.consumeInstallState, {
      nonce: payload.nonce,
      expire: true,
    });
    return new Response("state expired", { status: 400 });
  }

  // Ensure nonce exists and is pending
  const row = await ctx.runQuery(internal.github_app.getInstallStateByNonce, {
    nonce: payload.nonce,
  });
  if (!row || row.status !== "pending") {
    return new Response("invalid state nonce", { status: 400 });
  }

  // Mark used
  await ctx.runMutation(internal.github_app.consumeInstallState, {
    nonce: payload.nonce,
  });

  // Map installation -> team (create or patch connection)
  await ctx.runMutation(
    internal.github_app.upsertProviderConnectionFromInstallation,
    {
      installationId,
      teamId: payload.teamId,
      connectedByUserId: payload.userId,
      isActive: true,
    }
  );

  // Resolve slug for nicer redirect when available
  const team = await ctx.runQuery(internal.teams.getByTeamIdInternal, {
    teamId: payload.teamId,
  });
  const teamPath = team?.slug ?? payload.teamId;
  // If installation initiated from Electron, bounce back via deep link
  if ((payload.ui || "").toLowerCase() === "electron") {
    const deeplink = `cmux://connect-complete?team=${encodeURIComponent(teamPath)}`;
    return Response.redirect(deeplink, 302);
  }
  const target = `${base}/${encodeURIComponent(teamPath)}/connect-complete`;
  return Response.redirect(target, 302);
});
