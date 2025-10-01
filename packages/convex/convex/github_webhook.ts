import type {
  InstallationEvent,
  InstallationRepositoriesEvent,
  PullRequestEvent,
  PushEvent,
  WebhookEvent,
} from "@octokit/webhooks-types";
import { v } from "convex/values";
import { env } from "../_shared/convex-env";
import { hmacSha256, safeEqualHex, sha256Hex } from "../_shared/crypto";
import { bytesToHex } from "../_shared/encoding";
import {
  createInstallationAccessToken,
  normalizeGithubPrivateKey,
} from "../_shared/githubAppAuth";
import { internal } from "./_generated/api";
import { httpAction, internalAction } from "./_generated/server";

const DEBUG_FLAGS = {
  githubWebhook: false, // set true to emit verbose push diagnostics
};

const SYSTEM_REPO_USER_ID = "__system__";
const GITHUB_WEBHOOK_USER_AGENT = "cmux-github-webhook-sync";

type InstallationRepositoryRecord = {
  id?: number | null;
  name?: string | null;
  full_name?: string | null;
  owner?: {
    login?: string | null;
    type?: string | null;
  } | null;
  private?: boolean | null;
  visibility?: string | null;
  clone_url?: string | null;
  default_branch?: string | null;
  pushed_at?: string | number | null;
};

type InstallationRepositoriesResponse = {
  total_count?: number;
  repositories?: InstallationRepositoryRecord[];
};

type RepoSyncPayload = {
  providerRepoId: number;
  fullName: string;
  org: string;
  name: string;
  gitRemote: string;
  ownerLogin?: string;
  ownerType?: "User" | "Organization";
  visibility: "public" | "private";
  defaultBranch?: string;
  lastPushedAt?: number;
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

const MILLIS_THRESHOLD = 1_000_000_000_000;

function normalizeTimestamp(
  value: number | string | null | undefined
): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return undefined;
    const normalized = value > MILLIS_THRESHOLD ? value : value * 1000;
    return Math.round(normalized);
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    const normalized = numeric > MILLIS_THRESHOLD ? numeric : numeric * 1000;
    return Math.round(normalized);
  }
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }
  return undefined;
}

function hasNextPage(linkHeader: string | null): boolean {
  if (!linkHeader) return false;
  const parts = linkHeader.split(",");
  for (const part of parts) {
    if (part.includes('rel="next"')) {
      return true;
    }
  }
  return false;
}

function coerceOwnerType(
  input: unknown,
): RepoSyncPayload["ownerType"] {
  if (input === "Organization" || input === "User") {
    return input;
  }
  return undefined;
}

export const syncInstallationRepos = internalAction({
  args: { installationId: v.number() },
  handler: async (ctx, { installationId }) => {
    if (!env.CMUX_GITHUB_APP_ID || !env.CMUX_GITHUB_APP_PRIVATE_KEY) {
      console.warn("[github_webhook] GitHub app credentials missing");
      return;
    }

    const connection = await ctx.runQuery(
      internal.github_app.getProviderConnectionByInstallationId,
      { installationId },
    );
    if (!connection) {
      console.warn("[github_webhook] Installation not found", {
        installationId,
      });
      return;
    }
    if (!connection.teamId) {
      console.warn(
        "[github_webhook] Installation missing team mapping for repo sync",
        {
          installationId,
        },
      );
      return;
    }

    const normalizedPrivateKey = normalizeGithubPrivateKey(
      env.CMUX_GITHUB_APP_PRIVATE_KEY,
    );
    const tokenResult = await createInstallationAccessToken({
      appId: env.CMUX_GITHUB_APP_ID,
      privateKey: normalizedPrivateKey,
      installationId,
      userAgent: GITHUB_WEBHOOK_USER_AGENT,
    });
    if (!tokenResult) {
      return;
    }

    const token = tokenResult.token;
    let page = 1;
    const perPage = 100;
    const mutationPromises: Array<Promise<unknown>> = [];
    const userId = connection.connectedByUserId ?? SYSTEM_REPO_USER_ID;
    const connectionId = connection._id;

    while (true) {
      const response = await fetch(
        `https://api.github.com/installation/repositories?per_page=${perPage}&page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "User-Agent": GITHUB_WEBHOOK_USER_AGENT,
          },
        },
      );

      if (!response.ok) {
        const bodyText = await response.text().catch(() => "");
        console.error("[github_webhook] Failed to list installation repos", {
          installationId,
          status: response.status,
          body: bodyText,
        });
        break;
      }

      const json = (await response.json()) as InstallationRepositoriesResponse;
      const repos = json.repositories ?? [];
      const payload: RepoSyncPayload[] = repos
        .map((repo) => {
          const repoId = typeof repo.id === "number" ? repo.id : undefined;
          if (!repoId) {
            return null;
          }
          const ownerLogin =
            typeof repo.owner?.login === "string" && repo.owner.login.length > 0
              ? repo.owner.login
              : undefined;
          const name =
            typeof repo.name === "string" && repo.name.length > 0
              ? repo.name
              : undefined;
          const fullNameRaw =
            typeof repo.full_name === "string" && repo.full_name.length > 0
              ? repo.full_name
              : ownerLogin && name
                ? `${ownerLogin}/${name}`
                : undefined;
          if (!fullNameRaw) {
            return null;
          }
          const [orgPart, repoPart] = fullNameRaw.split("/");
          const org = orgPart || ownerLogin || fullNameRaw;
          const repoName = repoPart || name || fullNameRaw;
          const gitRemote =
            typeof repo.clone_url === "string" && repo.clone_url.length > 0
              ? repo.clone_url
              : `https://github.com/${fullNameRaw}.git`;
          const visibility = repo.private ? "private" : "public";
          const defaultBranch =
            typeof repo.default_branch === "string" &&
            repo.default_branch.length > 0
              ? repo.default_branch
              : undefined;
          const lastPushedAt = normalizeTimestamp(repo.pushed_at);

          return {
            providerRepoId: repoId,
            fullName: fullNameRaw,
            org,
            name: repoName,
            gitRemote,
            ownerLogin,
            ownerType: coerceOwnerType(repo.owner?.type ?? undefined),
            visibility,
            defaultBranch,
            lastPushedAt,
          } satisfies RepoSyncPayload | null;
        })
        .filter((repo): repo is RepoSyncPayload => repo !== null);

      if (payload.length > 0) {
        mutationPromises.push(
          ctx
            .runMutation(internal.github.syncReposFromWebhookBatch, {
              teamId: connection.teamId,
              connectionId,
              userId,
              repos: payload,
            })
            .catch((error) => {
              console.error(
                "[github_webhook] Failed to upsert repos from webhook batch",
                {
                  installationId,
                  error,
                },
              );
            }),
        );
      }

      if (!hasNextPage(response.headers.get("link"))) {
        break;
      }

      page += 1;
    }

    if (mutationPromises.length > 0) {
      await Promise.allSettled(mutationPromises);
    }
  },
});

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
            _ctx
              .runAction(internal.github_webhook.syncInstallationRepos, {
                installationId,
              })
              .catch((error) => {
                console.error(
                  "github_webhook repo sync failed after installation create",
                  {
                    error,
                    delivery,
                    installationId,
                  }
                );
              });
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
        if (installationId !== undefined) {
          const repoEvent = body as InstallationRepositoriesEvent;
          const action = repoEvent.action;
          if (action === "added" || action === "removed") {
            _ctx
              .runAction(internal.github_webhook.syncInstallationRepos, {
                installationId,
              })
              .catch((error) => {
                console.error(
                  "github_webhook repo sync failed after installation_repositories",
                  {
                    error,
                    delivery,
                    installationId,
                    action,
                  }
                );
              });
          }
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
          if (!teamId) break;
          await _ctx.runMutation(internal.github_prs.upsertFromWebhookPayload, {
            installationId: installation,
            repoFullName,
            teamId,
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
