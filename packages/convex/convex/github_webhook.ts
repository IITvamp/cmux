import type {
  CheckRunEvent,
  DeploymentEvent,
  DeploymentStatusEvent,
  InstallationEvent,
  InstallationRepositoriesEvent,
  PullRequestEvent,
  PushEvent,
  StatusEvent,
  WebhookEvent,
  WorkflowRunEvent,
} from "@octokit/webhooks-types";
import { env } from "../_shared/convex-env";
import { hmacSha256, safeEqualHex, sha256Hex } from "../_shared/crypto";
import { bytesToHex } from "../_shared/encoding";
import { streamInstallationRepositories } from "../_shared/githubApp";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import type { CheckRunWebhookPayload } from "./github_check_runs";
import type {
  DeploymentStatusWebhookPayload,
  DeploymentWebhookPayload,
} from "./github_deployments";
import type { PullRequestWebhookPayload } from "./github_prs";
import type { StatusWebhookPayload } from "./github_commit_statuses";
import type { WorkflowRunWebhookPayload } from "./github_workflows";

const DEBUG_FLAGS = {
  githubWebhook: false, // set true to emit verbose push diagnostics
};

async function verifySignature(
  secret: string,
  payload: string,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expectedHex = signatureHeader.slice("sha256=".length).toLowerCase();
  const sigBuf = await hmacSha256(secret, payload);
  const computedHex = bytesToHex(sigBuf).toLowerCase();
  return safeEqualHex(computedHex, expectedHex);
}

const MILLIS_THRESHOLD = 1_000_000_000_000;

function normalizeTimestamp(
  value: number | string | null | undefined,
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

const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function sanitizeStatusEvent(event: StatusEvent): StatusWebhookPayload {
  return {
    id: isNumber(event.id) ? event.id : undefined,
    sha: isString(event.sha) ? event.sha : undefined,
    context: isString(event.context) ? event.context : undefined,
    state: isString(event.state) ? event.state : undefined,
    repositoryId: isNumber(event.repository?.id) ? event.repository?.id : undefined,
    description: isString(event.description) ? event.description : undefined,
    targetUrl: isString(event.target_url) ? event.target_url : undefined,
    senderLogin: isString(event.sender?.login) ? event.sender?.login : undefined,
    createdAt:
      isString(event.created_at) || isNumber(event.created_at)
        ? event.created_at
        : undefined,
    updatedAt:
      isString(event.updated_at) || isNumber(event.updated_at)
        ? event.updated_at
        : undefined,
  };
}

function sanitizeCheckRunEvent(event: CheckRunEvent): CheckRunWebhookPayload {
  const pullRequestNumbers = event.check_run?.pull_requests?.map((pr) =>
    isNumber(pr?.number) ? pr.number : undefined,
  )
    .filter((value): value is number => value !== undefined);

  const completedAt = event.check_run?.completed_at;

  return {
    checkRunId: isNumber(event.check_run?.id) ? event.check_run?.id : undefined,
    name: isString(event.check_run?.name) ? event.check_run?.name : undefined,
    headSha: isString(event.check_run?.head_sha) ? event.check_run?.head_sha : undefined,
    status: isString(event.check_run?.status) ? event.check_run?.status : undefined,
    conclusion: isString(event.check_run?.conclusion)
      ? event.check_run?.conclusion
      : undefined,
    repositoryId: isNumber(event.repository?.id) ? event.repository?.id : undefined,
    htmlUrl: isString(event.check_run?.html_url) ? event.check_run?.html_url : undefined,
    appName: isString(event.check_run?.app?.name) ? event.check_run?.app?.name : undefined,
    appSlug: isString(event.check_run?.app?.slug) ? event.check_run?.app?.slug : undefined,
    updatedAt:
      isString(event.check_run?.updated_at) || isNumber(event.check_run?.updated_at)
        ? event.check_run?.updated_at
        : undefined,
    startedAt:
      isString(event.check_run?.started_at) || isNumber(event.check_run?.started_at)
        ? event.check_run?.started_at
        : undefined,
    completedAt:
      isString(completedAt) || isNumber(completedAt)
        ? completedAt
        : undefined,
    pullRequestNumbers: pullRequestNumbers && pullRequestNumbers.length > 0 ? pullRequestNumbers : undefined,
  };
}

function sanitizeWorkflowRunEvent(
  event: WorkflowRunEvent,
): WorkflowRunWebhookPayload {
  const pullRequestNumbers = event.workflow_run?.pull_requests?.map((pr) =>
    isNumber(pr?.number) ? pr.number : undefined,
  )
    .filter((value): value is number => value !== undefined);

  return {
    runId: isNumber(event.workflow_run?.id) ? event.workflow_run?.id : undefined,
    runNumber: isNumber(event.workflow_run?.run_number)
      ? event.workflow_run?.run_number
      : undefined,
    workflowId: isNumber(event.workflow_run?.workflow_id)
      ? event.workflow_run?.workflow_id
      : undefined,
    workflowName: isString(event.workflow?.name) ? event.workflow?.name : undefined,
    runName: isString(event.workflow_run?.name) ? event.workflow_run?.name : undefined,
    event: isString(event.workflow_run?.event) ? event.workflow_run?.event : undefined,
    status: isString(event.workflow_run?.status) ? event.workflow_run?.status : undefined,
    conclusion: isString(event.workflow_run?.conclusion)
      ? event.workflow_run?.conclusion
      : undefined,
    repositoryId: isNumber(event.repository?.id) ? event.repository?.id : undefined,
    headBranch: isString(event.workflow_run?.head_branch)
      ? event.workflow_run?.head_branch
      : undefined,
    headSha: isString(event.workflow_run?.head_sha)
      ? event.workflow_run?.head_sha
      : undefined,
    htmlUrl: isString(event.workflow_run?.html_url)
      ? event.workflow_run?.html_url
      : undefined,
    createdAt:
      isString(event.workflow_run?.created_at) || isNumber(event.workflow_run?.created_at)
        ? event.workflow_run?.created_at
        : undefined,
    updatedAt:
      isString(event.workflow_run?.updated_at) || isNumber(event.workflow_run?.updated_at)
        ? event.workflow_run?.updated_at
        : undefined,
    runStartedAt:
      isString(event.workflow_run?.run_started_at) || isNumber(event.workflow_run?.run_started_at)
        ? event.workflow_run?.run_started_at
        : undefined,
    runCompletedAt:
      isString(event.workflow_run?.completed_at) || isNumber(event.workflow_run?.completed_at)
        ? event.workflow_run?.completed_at
        : undefined,
    actorLogin: isString(event.workflow_run?.actor?.login)
      ? event.workflow_run?.actor?.login
      : undefined,
    actorId: isNumber(event.workflow_run?.actor?.id)
      ? event.workflow_run?.actor?.id
      : undefined,
    pullRequestNumbers: pullRequestNumbers && pullRequestNumbers.length > 0 ? pullRequestNumbers : undefined,
  };
}

function sanitizeDeploymentEvent(event: DeploymentEvent): DeploymentWebhookPayload {
  return {
    deploymentId: isNumber(event.deployment?.id) ? event.deployment?.id : undefined,
    sha: isString(event.deployment?.sha) ? event.deployment?.sha : undefined,
    ref: isString(event.deployment?.ref) ? event.deployment?.ref : undefined,
    task: isString(event.deployment?.task) ? event.deployment?.task : undefined,
    environment: isString(event.deployment?.environment)
      ? event.deployment?.environment
      : undefined,
    description: isString(event.deployment?.description)
      ? event.deployment?.description
      : undefined,
    creatorLogin: isString(event.deployment?.creator?.login)
      ? event.deployment?.creator?.login
      : undefined,
    createdAt:
      isString(event.deployment?.created_at) || isNumber(event.deployment?.created_at)
        ? event.deployment?.created_at
        : undefined,
    updatedAt:
      isString(event.deployment?.updated_at) || isNumber(event.deployment?.updated_at)
        ? event.deployment?.updated_at
        : undefined,
    repositoryId: isNumber(event.repository?.id) ? event.repository?.id : undefined,
  };
}

function sanitizeDeploymentStatusEvent(
  event: DeploymentStatusEvent,
): DeploymentStatusWebhookPayload {
  return {
    deploymentId: isNumber(event.deployment?.id) ? event.deployment?.id : undefined,
    sha: isString(event.deployment?.sha) ? event.deployment?.sha : undefined,
    state: isString(event.deployment_status?.state)
      ? event.deployment_status?.state
      : undefined,
    description: isString(event.deployment_status?.description)
      ? event.deployment_status?.description
      : undefined,
    logUrl: isString(event.deployment_status?.log_url)
      ? event.deployment_status?.log_url
      : undefined,
    targetUrl: isString(event.deployment_status?.target_url)
      ? event.deployment_status?.target_url
      : undefined,
    environmentUrl: isString(event.deployment_status?.environment_url)
      ? event.deployment_status?.environment_url
      : undefined,
    createdAt:
      isString(event.deployment?.created_at) || isNumber(event.deployment?.created_at)
        ? event.deployment?.created_at
        : undefined,
    updatedAt:
      isString(event.deployment_status?.updated_at) || isNumber(event.deployment_status?.updated_at)
        ? event.deployment_status?.updated_at
        : undefined,
    ref: isString(event.deployment?.ref) ? event.deployment?.ref : undefined,
    task: isString(event.deployment?.task) ? event.deployment?.task : undefined,
    environment: isString(event.deployment?.environment)
      ? event.deployment?.environment
      : undefined,
    creatorLogin: isString(event.deployment?.creator?.login)
      ? event.deployment?.creator?.login
      : undefined,
    repositoryId: isNumber(event.repository?.id) ? event.repository?.id : undefined,
  };
}

function sanitizePullRequestEvent(event: PullRequestEvent): PullRequestWebhookPayload {
  const pr = event.pull_request;
  const number = isNumber(pr?.number)
    ? pr?.number
    : isNumber(event.number)
      ? event.number
      : undefined;

  return {
    number,
    providerPrId: isNumber(pr?.id) ? pr?.id : undefined,
    repositoryId: isNumber(pr?.base?.repo?.id) ? pr?.base?.repo?.id : undefined,
    title: isString(pr?.title) ? pr?.title : undefined,
    state: isString(pr?.state) ? pr?.state : undefined,
    merged: typeof pr?.merged === "boolean" ? pr?.merged : undefined,
    draft: typeof pr?.draft === "boolean" ? pr?.draft : undefined,
    htmlUrl: isString(pr?.html_url) ? pr?.html_url : undefined,
    authorLogin: isString(pr?.user?.login) ? pr?.user?.login : undefined,
    authorId: isNumber(pr?.user?.id) ? pr?.user?.id : undefined,
    baseRef: isString(pr?.base?.ref) ? pr?.base?.ref : undefined,
    headRef: isString(pr?.head?.ref) ? pr?.head?.ref : undefined,
    baseSha: isString(pr?.base?.sha) ? pr?.base?.sha : undefined,
    headSha: isString(pr?.head?.sha) ? pr?.head?.sha : undefined,
    mergeCommitSha: isString(pr?.merge_commit_sha) ? pr?.merge_commit_sha : undefined,
    createdAt: isString(pr?.created_at) ? pr?.created_at : undefined,
    updatedAt: isString(pr?.updated_at) ? pr?.updated_at : undefined,
    closedAt: isString(pr?.closed_at) ? pr?.closed_at : undefined,
    mergedAt: isString(pr?.merged_at) ? pr?.merged_at : undefined,
    commentsCount: isNumber(pr?.comments) ? pr?.comments : undefined,
    reviewCommentsCount: isNumber(pr?.review_comments) ? pr?.review_comments : undefined,
    commitsCount: isNumber(pr?.commits) ? pr?.commits : undefined,
    additions: isNumber(pr?.additions) ? pr?.additions : undefined,
    deletions: isNumber(pr?.deletions) ? pr?.deletions : undefined,
    changedFiles: isNumber(pr?.changed_files) ? pr?.changed_files : undefined,
    baseRepoPushedAt: isString(pr?.base?.repo?.pushed_at)
      ? pr?.base?.repo?.pushed_at
      : undefined,
  };
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
    const result = await _ctx.runMutation(internal.github_app.recordWebhookDelivery, {
      provider: "github",
      deliveryId: delivery,
      installationId,
      payloadHash,
    });
    if (!result.created) {
      return new Response("ok (duplicate)", { status: 200 });
    }
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
              },
            );
          }
        } else if (action === "deleted") {
          if (installationId !== undefined) {
            await _ctx.runMutation(
              internal.github_app.deactivateProviderConnection,
              {
                installationId,
              },
            );
          }
        }
        break;
      }
      case "installation_repositories": {
        try {
          const inst = body as InstallationRepositoriesEvent;
          const installation = Number(inst.installation?.id ?? installationId ?? 0);
          if (!installation) {
            break;
          }

          const connection = await _ctx.runQuery(
            internal.github_app.getProviderConnectionByInstallationId,
            { installationId: installation },
          );
          if (!connection) {
            console.warn(
              "[github_webhook] No provider connection found for installation during repo sync",
              {
                installation,
                delivery,
              },
            );
            break;
          }

          const teamId = connection.teamId;
          const userId = connection.connectedByUserId;
          if (!teamId || !userId) {
            console.warn(
              "[github_webhook] Missing team/user context for installation repo sync",
              {
                installation,
                teamId,
                userId,
                delivery,
              },
            );
            break;
          }

          await streamInstallationRepositories(
            installation,
            (repos, currentPageIndex) =>
              (async () => {
                try {
                  await _ctx.runMutation(internal.github.syncReposForInstallation, {
                    teamId,
                    userId,
                    connectionId: connection._id,
                    repos,
                  });
                } catch (error) {
                  console.error(
                    "[github_webhook] Failed to sync installation repositories from webhook",
                    {
                      installation,
                      delivery,
                      pageIndex: currentPageIndex,
                      repoCount: repos.length,
                      error,
                    },
                  );
                }
              })(),
          );
        } catch (error) {
          console.error(
            "[github_webhook] Unexpected error handling installation_repositories webhook",
            {
              error,
              delivery,
            },
          );
        }
        break;
      }
      case "repository":
      case "create":
      case "delete":
      case "pull_request_review":
      case "pull_request_review_comment":
      case "issue_comment": {
        break;
      }
      case "workflow_run": {
        try {
          const workflowRunPayload = body as WorkflowRunEvent;
          const repoFullName = String(
            workflowRunPayload.repository?.full_name ?? "",
          );
          const installation = Number(workflowRunPayload.installation?.id ?? 0);


          if (!repoFullName || !installation) {
            console.warn("[workflow_run] Missing repoFullName or installation", {
              repoFullName,
              installation,
              delivery,
            });
            break;
          }

          const conn = await _ctx.runQuery(
            internal.github_app.getProviderConnectionByInstallationId,
            { installationId: installation },
          );
          const teamId = conn?.teamId;

          if (!teamId) {
            console.warn("[workflow_run] No teamId found for installation", {
              installation,
              delivery,
              connectionFound: !!conn,
            });
            break;
          }


          await _ctx.runMutation(
            internal.github_workflows.upsertWorkflowRunFromWebhook,
            {
              installationId: installation,
              repoFullName,
              teamId,
              payload: sanitizeWorkflowRunEvent(workflowRunPayload),
            },
          );

        } catch (err) {
          console.error("[workflow_run] Handler failed", {
            err,
            delivery,
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          });
        }
        break;
      }
      case "workflow_job": {
        // For now, just acknowledge workflow_job events without processing
        // In the future, we could track individual job details if needed
        break;
      }
      case "check_run": {
        try {
          const checkRunPayload = body as CheckRunEvent;
          const repoFullName = String(checkRunPayload.repository?.full_name ?? "");
          const installation = Number(checkRunPayload.installation?.id ?? 0);


          if (!repoFullName || !installation) {
            console.warn("[check_run] Missing repoFullName or installation", {
              repoFullName,
              installation,
              delivery,
            });
            break;
          }

          const conn = await _ctx.runQuery(
            internal.github_app.getProviderConnectionByInstallationId,
            { installationId: installation },
          );
          const teamId = conn?.teamId;

          if (!teamId) {
            console.warn("[check_run] No teamId found for installation", {
              installation,
              delivery,
              connectionFound: !!conn,
            });
            break;
          }


          await _ctx.runMutation(internal.github_check_runs.upsertCheckRunFromWebhook, {
            installationId: installation,
            repoFullName,
            teamId,
            payload: sanitizeCheckRunEvent(checkRunPayload),
          });

        } catch (err) {
          console.error("[check_run] Handler failed", {
            err,
            delivery,
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          });
        }
        break;
      }
      case "check_suite": {
        break;
      }
      case "deployment": {
        try {
          const deploymentPayload = body as DeploymentEvent;
          const repoFullName = String(deploymentPayload.repository?.full_name ?? "");
          const installation = Number(deploymentPayload.installation?.id ?? 0);


          if (!repoFullName || !installation) {
            console.warn("[deployment] Missing repoFullName or installation", {
              repoFullName,
              installation,
              delivery,
            });
            break;
          }

          const conn = await _ctx.runQuery(
            internal.github_app.getProviderConnectionByInstallationId,
            { installationId: installation },
          );
          const teamId = conn?.teamId;

          if (!teamId) {
            console.warn("[deployment] No teamId found for installation", {
              installation,
              delivery,
              connectionFound: !!conn,
            });
            break;
          }

          await _ctx.runMutation(
            internal.github_deployments.upsertDeploymentFromWebhook,
            {
              installationId: installation,
              repoFullName,
              teamId,
              payload: sanitizeDeploymentEvent(deploymentPayload),
            },
          );

        } catch (err) {
          console.error("[deployment] Handler failed", {
            err,
            delivery,
            message: err instanceof Error ? err.message : String(err),
          });
        }
        break;
      }
      case "deployment_status": {
        try {
          const deploymentStatusPayload = body as DeploymentStatusEvent;
          const repoFullName = String(deploymentStatusPayload.repository?.full_name ?? "");
          const installation = Number(deploymentStatusPayload.installation?.id ?? 0);


          if (!repoFullName || !installation) {
            console.warn("[deployment_status] Missing repoFullName or installation", {
              repoFullName,
              installation,
              delivery,
            });
            break;
          }

          const conn = await _ctx.runQuery(
            internal.github_app.getProviderConnectionByInstallationId,
            { installationId: installation },
          );
          const teamId = conn?.teamId;

          if (!teamId) {
            console.warn("[deployment_status] No teamId found for installation", {
              installation,
              delivery,
              connectionFound: !!conn,
            });
            break;
          }

          await _ctx.runMutation(
            internal.github_deployments.updateDeploymentStatusFromWebhook,
            {
              installationId: installation,
              repoFullName,
              teamId,
              payload: sanitizeDeploymentStatusEvent(deploymentStatusPayload),
            },
          );

        } catch (err) {
          console.error("[deployment_status] Handler failed", {
            err,
            delivery,
            message: err instanceof Error ? err.message : String(err),
          });
        }
        break;
      }
      case "status": {
        try {
          const statusPayload = body as StatusEvent;
          const repoFullName = String(statusPayload.repository?.full_name ?? "");
          const installation = Number(statusPayload.installation?.id ?? 0);


          if (!repoFullName || !installation) {
            console.warn("[status] Missing repoFullName or installation", {
              repoFullName,
              installation,
              delivery,
            });
            break;
          }

          const conn = await _ctx.runQuery(
            internal.github_app.getProviderConnectionByInstallationId,
            { installationId: installation },
          );
          const teamId = conn?.teamId;

          if (!teamId) {
            console.warn("[status] No teamId found for installation", {
              installation,
              delivery,
              connectionFound: !!conn,
            });
            break;
          }

          await _ctx.runMutation(
            internal.github_commit_statuses.upsertCommitStatusFromWebhook,
            {
              installationId: installation,
              repoFullName,
              teamId,
              payload: sanitizeStatusEvent(statusPayload),
            },
          );

        } catch (err) {
          console.error("[status] Handler failed", {
            err,
            delivery,
            message: err instanceof Error ? err.message : String(err),
          });
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
            { installationId: installation },
          );
          const teamId = conn?.teamId;
          if (!teamId) break;
          await _ctx.runMutation(internal.github_prs.upsertFromWebhookPayload, {
            installationId: installation,
            repoFullName,
            teamId,
            payload: sanitizePullRequestEvent(prPayload),
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
            { installationId: installation },
          );
          const teamId = conn?.teamId;
          if (!teamId) break;
          const repoPushedAt = normalizeTimestamp(
            pushPayload.repository?.pushed_at,
          );
          const headCommitAt = normalizeTimestamp(
            pushPayload.head_commit?.timestamp,
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
          await _ctx.runMutation(
            internal.github.updateRepoActivityFromWebhook,
            {
              teamId,
              repoFullName,
              pushedAt: pushedAtMillis,
              providerRepoId,
            },
          );
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
