import type {
  InstallationEvent,
  PullRequestEvent,
  WebhookEvent,
} from "@octokit/webhooks-types";
import { env } from "../_shared/convex-env";
import { bytesToHex } from "../_shared/encoding";
import { hmacSha256, safeEqualHex, sha256Hex } from "../_shared/crypto";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

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
  const installationId: number | undefined = (body as WithInstallation).installation?.id;

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
      case "installation_repositories":
      case "repository":
      case "create":
      case "delete":
      case "push":
      case "pull_request":
      case "pull_request_review":
      case "pull_request_review_comment":
      case "issue_comment":
      case "check_suite":
      case "check_run":
      case "status":
      case "workflow_run":
      case "workflow_job": {
        if (event === "pull_request") {
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
          } catch (_err) {
            // swallow
          }
        }
        // Handle CI checks/status-like events and persist normalized records
        try {
          const repoFullName = String((body as any)?.repository?.full_name ?? "");
          const installation = Number((body as any)?.installation?.id ?? 0);
          if (repoFullName && installation) {
            const conn = await _ctx.runQuery(
              internal.github_app.getProviderConnectionByInstallationId,
              { installationId: installation }
            );
            const teamId = conn?.teamId;
            if (teamId) {
              // Normalize by event type
              if (event === "check_run") {
                const cr = (body as any).check_run ?? {};
                const cs = (body as any).check_run?.check_suite ?? (body as any).check_suite ?? {};
                const sha = String(cr?.head_sha ?? cr?.pull_requests?.[0]?.head?.sha ?? cs?.head_sha ?? "");
                const name = String(cr?.name ?? "");
                if (sha && name) {
                  const status: string | undefined = typeof cr?.status === "string" ? cr.status : undefined;
                  const conclusion: string | undefined = typeof cr?.conclusion === "string" ? cr.conclusion : undefined;
                  const startedAt = typeof cr?.started_at === "string" ? Date.parse(cr.started_at) : undefined;
                  const completedAt = typeof cr?.completed_at === "string" ? Date.parse(cr.completed_at) : undefined;
                  const detailsUrl = typeof cr?.html_url === "string" ? cr.html_url : undefined;
                  const branch = typeof cs?.head_branch === "string" ? cs.head_branch : undefined;
                  await _ctx.runMutation(internal.github_checks.upsertFromWebhook, {
                    installationId: installation,
                    teamId,
                    repoFullName,
                    sha,
                    branch,
                    checkType: "check_run",
                    name,
                    status: status as any,
                    conclusion: conclusion as any,
                    detailsUrl,
                    externalId: String(cr?.id ?? ""),
                    startedAt,
                    completedAt,
                  });
                }
              } else if (event === "status") {
                const st = (body as any) ?? {};
                const sha = String(st?.sha ?? "");
                const name = String(st?.context ?? "");
                if (sha && name) {
                  const stateStr = String(st?.state ?? ""); // success | failure | pending | error
                  const detailsUrl = typeof st?.target_url === "string" ? st.target_url : undefined;
                  const branches = Array.isArray(st?.branches) ? st.branches : [];
                  const branch = branches.length > 0 && typeof branches[0]?.name === "string" ? branches[0].name : undefined;
                  // Map GitHub Status API to our fields
                  const conclusion =
                    stateStr === "success"
                      ? "success"
                      : stateStr === "failure" || stateStr === "error"
                      ? (stateStr as any)
                      : undefined;
                  const statusNorm: any = stateStr === "pending" ? "pending" : conclusion ? "completed" : undefined;
                  await _ctx.runMutation(internal.github_checks.upsertFromWebhook, {
                    installationId: installation,
                    teamId,
                    repoFullName,
                    sha,
                    branch,
                    checkType: "status",
                    name,
                    status: statusNorm,
                    conclusion: conclusion as any,
                    detailsUrl,
                    externalId: name,
                  });
                }
              } else if (event === "workflow_run") {
                const wr = (body as any).workflow_run ?? {};
                const sha = String(wr?.head_sha ?? "");
                const name = String(wr?.name ?? "");
                if (sha && name) {
                  const status: string | undefined = typeof wr?.status === "string" ? wr.status : undefined;
                  const conclusion: string | undefined = typeof wr?.conclusion === "string" ? wr.conclusion : undefined;
                  const branch = typeof wr?.head_branch === "string" ? wr.head_branch : undefined;
                  const detailsUrl = typeof wr?.html_url === "string" ? wr.html_url : undefined;
                  const createdAt = typeof wr?.created_at === "string" ? Date.parse(wr.created_at) : undefined;
                  const updatedAt = typeof wr?.updated_at === "string" ? Date.parse(wr.updated_at) : undefined;
                  await _ctx.runMutation(internal.github_checks.upsertFromWebhook, {
                    installationId: installation,
                    teamId,
                    repoFullName,
                    sha,
                    branch,
                    checkType: "workflow_run",
                    name,
                    status: status as any,
                    conclusion: conclusion as any,
                    detailsUrl,
                    externalId: String(wr?.id ?? ""),
                    startedAt: createdAt,
                    completedAt: updatedAt,
                  });
                }
              } else if (event === "workflow_job") {
                const wj = (body as any).workflow_job ?? {};
                const sha = String(wj?.head_sha ?? "");
                const name = String(wj?.name ?? "");
                if (sha && name) {
                  const status: string | undefined = typeof wj?.status === "string" ? wj.status : undefined;
                  const conclusion: string | undefined = typeof wj?.conclusion === "string" ? wj.conclusion : undefined;
                  const detailsUrl = typeof wj?.html_url === "string" ? wj.html_url : undefined;
                  const startedAt = typeof wj?.started_at === "string" ? Date.parse(wj.started_at) : undefined;
                  const completedAt = typeof wj?.completed_at === "string" ? Date.parse(wj.completed_at) : undefined;
                  await _ctx.runMutation(internal.github_checks.upsertFromWebhook, {
                    installationId: installation,
                    teamId,
                    repoFullName,
                    sha,
                    checkType: "workflow_job",
                    name,
                    status: status as any,
                    conclusion: conclusion as any,
                    detailsUrl,
                    externalId: String(wj?.id ?? ""),
                    startedAt,
                    completedAt,
                  });
                }
              }
            }
          }
        } catch (_err) {
          // swallow
        }
        break;
      }
      default: {
        // Accept unknown events to avoid retries.
        break;
      }
    }
  } catch (_err) {
    // Swallow errors to avoid GitHub retries while we iterate
  }

  return new Response("ok", { status: 200 });
});
