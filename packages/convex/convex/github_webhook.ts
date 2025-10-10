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
import {
  type GithubCheckRunEventPayload,
  type GithubCommitStatusEventPayload,
  type GithubDeploymentEventPayload,
  type GithubDeploymentStatusEventPayload,
  type GithubPullRequestEventPayload,
  type GithubWorkflowRunEventPayload,
} from "../_shared/github_webhook_validators";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

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

export const githubWebhook = httpAction(async (_ctx, req) => {
  if (!env.GITHUB_APP_WEBHOOK_SECRET) {
    return new Response("webhook not configured", { status: 501 });
  }
  const rawPayload = await req.text();
  const event = req.headers.get("x-github-event");
  const delivery = req.headers.get("x-github-delivery");
  const signature = req.headers.get("x-hub-signature-256");

  if (
    !(await verifySignature(env.GITHUB_APP_WEBHOOK_SECRET, rawPayload, signature))
  ) {
    return new Response("invalid signature", { status: 400 });
  }

  let body: WebhookEvent;
  try {
    body = JSON.parse(rawPayload) as WebhookEvent;
  } catch {
    return new Response("invalid payload", { status: 400 });
  }

  type WithInstallation = { installation?: { id?: number } };
  const installationId: number | undefined = (body as WithInstallation)
    .installation?.id;

  // Record delivery for idempotency/auditing
  if (delivery) {
    const payloadHash = await sha256Hex(rawPayload);
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


          const payload: GithubWorkflowRunEventPayload = {
            workflow_run: workflowRunPayload.workflow_run ? {
              id: workflowRunPayload.workflow_run.id,
              run_number: workflowRunPayload.workflow_run.run_number,
              workflow_id: workflowRunPayload.workflow_run.workflow_id,
              name: workflowRunPayload.workflow_run.name,
              event: workflowRunPayload.workflow_run.event,
              status: workflowRunPayload.workflow_run.status,
              conclusion: ((workflowRunPayload.workflow_run as unknown as Record<string, unknown>).conclusion as string | null | undefined) ?? undefined,
              head_branch: workflowRunPayload.workflow_run.head_branch,
              head_sha: workflowRunPayload.workflow_run.head_sha,
              html_url: workflowRunPayload.workflow_run.html_url,
              created_at: workflowRunPayload.workflow_run.created_at,
              updated_at: workflowRunPayload.workflow_run.updated_at,
              run_started_at: workflowRunPayload.workflow_run.run_started_at,
              completed_at: ((workflowRunPayload.workflow_run as unknown as Record<string, unknown>).completed_at as string | null | undefined) ?? undefined,
              actor: workflowRunPayload.workflow_run.actor ? {
                login: workflowRunPayload.workflow_run.actor.login,
                id: workflowRunPayload.workflow_run.actor.id,
              } : undefined,
              pull_requests: workflowRunPayload.workflow_run.pull_requests?.map(pr => ({
                number: pr.number,
              })),
            } : undefined,
            workflow: workflowRunPayload.workflow ? {
              name: workflowRunPayload.workflow.name,
            } : undefined,
            repository: workflowRunPayload.repository ? {
              id: workflowRunPayload.repository.id,
              pushed_at: typeof workflowRunPayload.repository.pushed_at === "string"
                ? workflowRunPayload.repository.pushed_at
                : undefined,
            } : undefined,
          };

          await _ctx.runMutation(
            internal.github_workflows.upsertWorkflowRunFromWebhook,
            {
              installationId: installation,
              repoFullName,
              teamId,
              payload,
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


          const payload: GithubCheckRunEventPayload = {
            check_run: checkRunPayload.check_run ? {
              id: checkRunPayload.check_run.id,
              name: checkRunPayload.check_run.name,
              head_sha: checkRunPayload.check_run.head_sha,
              status: checkRunPayload.check_run.status,
              conclusion: ((checkRunPayload.check_run as Record<string, unknown>).conclusion as string | null | undefined) ?? undefined,
              html_url: checkRunPayload.check_run.html_url,
              updated_at: ((checkRunPayload.check_run as Record<string, unknown>).updated_at as string | null | undefined) ?? undefined,
              started_at: ((checkRunPayload.check_run as Record<string, unknown>).started_at as string | null | undefined) ?? undefined,
              completed_at: ((checkRunPayload.check_run as Record<string, unknown>).completed_at as string | null | undefined) ?? undefined,
              app: checkRunPayload.check_run.app ? {
                name: checkRunPayload.check_run.app.name,
                slug: checkRunPayload.check_run.app.slug,
              } : undefined,
              pull_requests: checkRunPayload.check_run.pull_requests?.map(pr => ({
                number: pr.number,
              })),
            } : undefined,
            repository: checkRunPayload.repository ? {
              id: checkRunPayload.repository.id,
              pushed_at: typeof checkRunPayload.repository.pushed_at === "string"
                ? checkRunPayload.repository.pushed_at
                : undefined,
            } : undefined,
          };

          await _ctx.runMutation(internal.github_check_runs.upsertCheckRunFromWebhook, {
            installationId: installation,
            repoFullName,
            teamId,
            payload,
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

          const payload: GithubDeploymentEventPayload = {
            deployment: deploymentPayload.deployment ? {
              id: deploymentPayload.deployment.id,
              sha: deploymentPayload.deployment.sha,
              ref: deploymentPayload.deployment.ref,
              task: deploymentPayload.deployment.task,
              environment: deploymentPayload.deployment.environment,
              description: deploymentPayload.deployment.description ?? undefined,
              creator: deploymentPayload.deployment.creator ? {
                login: deploymentPayload.deployment.creator.login,
                id: deploymentPayload.deployment.creator.id,
              } : undefined,
              created_at: deploymentPayload.deployment.created_at,
              updated_at: deploymentPayload.deployment.updated_at,
            } : undefined,
            repository: deploymentPayload.repository ? {
              id: deploymentPayload.repository.id,
              pushed_at: typeof deploymentPayload.repository.pushed_at === "string"
                ? deploymentPayload.repository.pushed_at
                : undefined,
            } : undefined,
          };

          await _ctx.runMutation(
            internal.github_deployments.upsertDeploymentFromWebhook,
            {
              installationId: installation,
              repoFullName,
              teamId,
              payload,
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

          const payload: GithubDeploymentStatusEventPayload = {
            deployment: deploymentStatusPayload.deployment ? {
              id: deploymentStatusPayload.deployment.id,
              sha: deploymentStatusPayload.deployment.sha,
              ref: deploymentStatusPayload.deployment.ref,
              task: deploymentStatusPayload.deployment.task,
              environment: deploymentStatusPayload.deployment.environment,
              description: deploymentStatusPayload.deployment.description ?? undefined,
              creator: deploymentStatusPayload.deployment.creator ? {
                login: deploymentStatusPayload.deployment.creator.login,
                id: deploymentStatusPayload.deployment.creator.id,
              } : undefined,
              created_at: deploymentStatusPayload.deployment.created_at,
              updated_at: deploymentStatusPayload.deployment.updated_at,
            } : undefined,
            deployment_status: deploymentStatusPayload.deployment_status ? {
              state: deploymentStatusPayload.deployment_status.state,
              description: deploymentStatusPayload.deployment_status.description ?? undefined,
              log_url: deploymentStatusPayload.deployment_status.log_url,
              target_url: deploymentStatusPayload.deployment_status.target_url,
              environment_url: deploymentStatusPayload.deployment_status.environment_url,
              updated_at: deploymentStatusPayload.deployment_status.updated_at,
            } : undefined,
            repository: deploymentStatusPayload.repository ? {
              id: deploymentStatusPayload.repository.id,
              pushed_at: typeof deploymentStatusPayload.repository.pushed_at === "string"
                ? deploymentStatusPayload.repository.pushed_at
                : undefined,
            } : undefined,
          };

          await _ctx.runMutation(
            internal.github_deployments.updateDeploymentStatusFromWebhook,
            {
              installationId: installation,
              repoFullName,
              teamId,
              payload,
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

          const payload: GithubCommitStatusEventPayload = {
            id: statusPayload.id,
            sha: statusPayload.sha,
            state: statusPayload.state,
            description: statusPayload.description ?? undefined,
            target_url: statusPayload.target_url ?? undefined,
            context: statusPayload.context,
            created_at: statusPayload.created_at,
            updated_at: statusPayload.updated_at,
            repository: statusPayload.repository ? {
              id: statusPayload.repository.id,
              pushed_at: typeof statusPayload.repository.pushed_at === "string"
                ? statusPayload.repository.pushed_at
                : undefined,
            } : undefined,
            sender: statusPayload.sender ? {
              login: statusPayload.sender.login,
              id: statusPayload.sender.id,
            } : undefined,
          }

          await _ctx.runMutation(
            internal.github_commit_statuses.upsertCommitStatusFromWebhook,
            {
              installationId: installation,
              repoFullName,
              teamId,
              payload,
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
          const payload: GithubPullRequestEventPayload = {
            pull_request: prPayload.pull_request ? {
              number: prPayload.pull_request.number,
              id: prPayload.pull_request.id,
              title: prPayload.pull_request.title,
              state: prPayload.pull_request.state,
              merged: prPayload.pull_request.merged ?? undefined,
              draft: prPayload.pull_request.draft,
              html_url: prPayload.pull_request.html_url ?? undefined,
              merge_commit_sha: prPayload.pull_request.merge_commit_sha ?? undefined,
              created_at: prPayload.pull_request.created_at ?? undefined,
              updated_at: prPayload.pull_request.updated_at ?? undefined,
              closed_at: prPayload.pull_request.closed_at ?? undefined,
              merged_at: prPayload.pull_request.merged_at ?? undefined,
              comments: prPayload.pull_request.comments,
              review_comments: prPayload.pull_request.review_comments,
              commits: prPayload.pull_request.commits,
              additions: prPayload.pull_request.additions,
              deletions: prPayload.pull_request.deletions,
              changed_files: prPayload.pull_request.changed_files,
              user: prPayload.pull_request.user ? {
                login: prPayload.pull_request.user.login,
                id: prPayload.pull_request.user.id,
              } : undefined,
              base: prPayload.pull_request.base ? {
                ref: prPayload.pull_request.base.ref,
                sha: prPayload.pull_request.base.sha,
                repo: prPayload.pull_request.base.repo ? {
                  id: prPayload.pull_request.base.repo.id,
                  pushed_at: typeof prPayload.pull_request.base.repo.pushed_at === "string"
                    ? prPayload.pull_request.base.repo.pushed_at
                    : undefined,
                } : undefined,
              } : undefined,
              head: prPayload.pull_request.head ? {
                ref: prPayload.pull_request.head.ref,
                sha: prPayload.pull_request.head.sha,
                repo: prPayload.pull_request.head.repo ? {
                  id: prPayload.pull_request.head.repo.id,
                  pushed_at: typeof prPayload.pull_request.head.repo.pushed_at === "string"
                    ? prPayload.pull_request.head.repo.pushed_at
                    : undefined,
                } : undefined,
              } : undefined,
            } : undefined,
            number: prPayload.number,
          };
          await _ctx.runMutation(internal.github_prs.upsertFromWebhookPayload, {
            installationId: installation,
            repoFullName,
            teamId,
            payload,
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
