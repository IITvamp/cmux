import type {
  InstallationEvent,
  InstallationRepositoriesEvent,
  PullRequestEvent,
  PushEvent,
  WebhookEvent,
} from "@octokit/webhooks-types";
import { env } from "../_shared/convex-env";
import { hmacSha256, safeEqualHex, sha256Hex } from "../_shared/crypto";
import { bytesToHex } from "../_shared/encoding";
import {
  generateInstallationAccessToken,
  normalizeGithubPrivateKey,
} from "../_shared/githubApp";
import {
  transformGitHubRepo,
  normalizeTimestamp,
  type GitHubRepository,
} from "../_shared/github";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const DEBUG_FLAGS = {
  githubWebhook: false, // set true to emit verbose push diagnostics
};

async function verifySignature(
  secret: string,
  payload: string,
  signatureHeader: string | null
): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expectedHex = signatureHeader.slice("sha256=".length).toLowerCase();
  const sigBuf = await hmacSha256(secret, payload);
  const computedHex = bytesToHex(sigBuf).toLowerCase();
  return safeEqualHex(computedHex, expectedHex);
}

async function ingestAllReposForInstallation(
  _ctx: {
    runQuery: (fn: any, args: any) => Promise<any>;
    scheduler: { runAfter: (delay: number, fn: any, args: any) => void };
  },
  installation: number
) {
  const connection = await _ctx.runQuery(
    internal.github_app.getProviderConnectionByInstallationId,
    { installationId: installation }
  );
  if (!connection?.teamId || !connection?.connectedByUserId) {
    console.error(
      "github_webhook: connection missing teamId or connectedByUserId",
      { installation }
    );
    return;
  }
  if (!env.CMUX_GITHUB_APP_ID || !env.CMUX_GITHUB_APP_PRIVATE_KEY) {
    console.error(
      "github_webhook: missing GitHub app credentials"
    );
    return;
  }

  const normalizedKey = normalizeGithubPrivateKey(
    env.CMUX_GITHUB_APP_PRIVATE_KEY
  );
  const tokenInfo = await generateInstallationAccessToken({
    installationId: installation,
    appId: env.CMUX_GITHUB_APP_ID,
    privateKey: normalizedKey,
    userAgent: "cmux-github-webhook",
  });
  const accessToken = tokenInfo?.token;
  if (!accessToken) {
    console.error("github_webhook: failed to get installation token", {
      installation,
    });
    return;
  }

  const perPage = 100;
  let page = 1;
  while (true) {
    const url = new URL("https://api.github.com/installation/repositories");
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "cmux-github-webhook",
      },
    });
    if (!response.ok) {
      console.error("github_webhook: fetch failed", {
        installation,
        status: response.status,
        page,
      });
      break;
    }
    const data = (await response.json()) as {
      repositories?: GitHubRepository[];
    };
    const repos = Array.isArray(data.repositories) ? data.repositories : [];
    if (repos.length === 0) {
      break;
    }

    const transformed = repos.map(transformGitHubRepo).filter((r) => r !== null);

    if (transformed.length > 0) {
      _ctx.scheduler.runAfter(0, internal.github.upsertRepos, {
        teamId: connection.teamId,
        connectionId: connection._id,
        userId: connection.connectedByUserId,
        repos: transformed,
      });
    }

    if (repos.length < perPage) {
      break;
    }
    page += 1;
  }
}

export const githubWebhook = httpAction(async (_ctx, req) => {
  if (!env.GITHUB_APP_WEBHOOK_SECRET) {
    return new Response("webhook not configured", { status: 501 });
  }
  const payload = await req.text();
  const event = req.headers.get("x-github-event");
  const delivery = req.headers.get("x-github-delivery");
  const signature = req.headers.get("x-hub-signature-256");

  if (
    !(await verifySignature(env.GITHUB_APP_WEBHOOK_SECRET, payload, signature))
  ) {
    return new Response("invalid signature", { status: 400 });
  }

  let body: WebhookEvent;
  try {
    body = JSON.parse(payload) as WebhookEvent;
  } catch {
    return new Response("invalid payload", { status: 400 });
  }

  type WithInstallation = { installation?: { id?: number } };
  const installationId: number | undefined = (body as WithInstallation)
    .installation?.id;

  // Record delivery for idempotency/auditing
  if (delivery) {
    const payloadHash = await sha256Hex(payload);
    await _ctx.runMutation(internal.github_app.recordWebhookDelivery, {
      provider: "github",
      deliveryId: delivery,
      installationId,
      payloadHash,
    });
  }

  // Handle ping quickly
  if (event === "ping") {
    return new Response("pong", { status: 200 });
  }

  try {
    switch (event) {
      case "installation": {
        const inst = body as InstallationEvent;
        const action = inst?.action as string | undefined;
        if (!action) break;
        if (action === "created") {
          const account = inst?.installation?.account;
          if (account && installationId !== undefined) {
            await _ctx.runMutation(
              internal.github_app.upsertProviderConnectionFromInstallation,
              {
                installationId,
                accountLogin: String(account.login ?? ""),
                accountId: Number(account.id ?? 0),
                accountType:
                  account.type === "Organization" ? "Organization" : "User",
              }
            );
          }
        } else if (action === "deleted") {
          if (installationId !== undefined) {
            await _ctx.runMutation(
              internal.github_app.deactivateProviderConnection,
              {
                installationId,
              }
            );
          }
        }
        break;
      }
      case "repository":
      case "create":
      case "delete":
      case "pull_request_review":
      case "pull_request_review_comment":
      case "issue_comment":
      case "check_suite":
      case "check_run":
      case "status":
      case "workflow_run":
      case "workflow_job": {
        // Acknowledge unsupported events without retries for now.
        break;
      }
      case "installation_repositories": {
        try {
          const repoPayload = body as InstallationRepositoriesEvent;
          const installation = Number(
            repoPayload.installation?.id ?? installationId ?? 0
          );
          if (!installation) break;
          await ingestAllReposForInstallation(_ctx, installation);
        } catch (err) {
          console.error(
            "github_webhook installation_repositories handler failed",
            {
              err,
              delivery,
            }
          );
        }
        break;
      }
      case "pull_request": {
        try {
          const prPayload = body as PullRequestEvent;
          const repoFullName = String(prPayload.repository?.full_name ?? "");
          const installation = Number(prPayload.installation?.id ?? 0);
          if (!repoFullName || !installation) break;
          const conn = await _ctx.runQuery(
            internal.github_app.getProviderConnectionByInstallationId,
            { installationId: installation }
          );
          const teamId = conn?.teamId;
          const userId = conn?.connectedByUserId;
          if (!teamId || !userId) break;
          await _ctx.runMutation(internal.github_prs.upsertFromWebhookPayload, {
            installationId: installation,
            repoFullName,
            teamId,
            userId,
            payload: prPayload,
          });
        } catch (err) {
          console.error("github_webhook pull_request handler failed", {
            err,
            delivery,
          });
        }
        break;
      }
      case "push": {
        try {
          const pushPayload = body as PushEvent;
          const repoFullName = String(pushPayload.repository?.full_name ?? "");
          const installation = Number(pushPayload.installation?.id ?? 0);
          if (!repoFullName || !installation) break;
          const conn = await _ctx.runQuery(
            internal.github_app.getProviderConnectionByInstallationId,
            { installationId: installation }
          );
          const teamId = conn?.teamId;
          if (!teamId) break;
          const repoPushedAt = normalizeTimestamp(
            pushPayload.repository?.pushed_at
          );
          const headCommitAt = normalizeTimestamp(
            pushPayload.head_commit?.timestamp
          );
          const pushedAtMillis = repoPushedAt ?? headCommitAt ?? Date.now();
          const providerRepoId =
            typeof pushPayload.repository?.id === "number"
              ? pushPayload.repository.id
              : undefined;
          if (DEBUG_FLAGS.githubWebhook) {
            console.debug("github_webhook push handler debug", {
              delivery,
              repoFullName,
              installation,
              pushedAtMillis,
              providerRepoId,
            });
          }
          await _ctx.runMutation(internal.github.updateRepoActivityFromWebhook, {
            teamId,
            repoFullName,
            pushedAt: pushedAtMillis,
            providerRepoId,
          });
        } catch (err) {
          console.error("github_webhook push handler failed", {
            err,
            delivery,
          });
        }
        break;
      }
      default: {
        // Accept unknown events to avoid retries.
        break;
      }
    }
  } catch (err) {
    console.error("github_webhook dispatch failed", { err, delivery, event });
    // Swallow errors to avoid GitHub retries while we iterate
  }

  return new Response("ok", { status: 200 });
});
