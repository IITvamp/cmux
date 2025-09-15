import type {
  CheckRunEvent,
  CheckSuiteEvent,
  InstallationEvent,
  PullRequestEvent,
  StatusEvent,
  WebhookEvent,
  WorkflowJobEvent,
  WorkflowRunEvent,
} from "@octokit/webhooks-types";
import { env } from "../_shared/convex-env";
import { bytesToHex } from "../_shared/encoding";
import { hmacSha256, safeEqualHex, sha256Hex } from "../_shared/crypto";
import { internal } from "./_generated/api";
import { httpAction, type ActionCtx } from "./_generated/server";
import type { UpsertExecutionArgs } from "./github_checks";

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

const parseIsoDate = (value: string | null | undefined) => {
  if (!value) return undefined;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : undefined;
};

const nonEmpty = (value: string | null | undefined) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalNumber = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const composeExternalId = (
  prefix:
    | "status"
    | "check_suite"
    | "check_run"
    | "workflow_run"
    | "workflow_job",
  primary: number | string | null | undefined,
  fallbackParts: Array<string | null | undefined>
) => {
  if (typeof primary === "string" && primary.length > 0) {
    return `${prefix}:${primary}`;
  }
  if (typeof primary === "number" && Number.isFinite(primary)) {
    return `${prefix}:${primary}`;
  }
  const fallback = fallbackParts
    .map((part) => nonEmpty(part ?? undefined))
    .filter((part): part is string => typeof part === "string")
    .join(":");
  if (fallback.length > 0) {
    return `${prefix}:${fallback}`;
  }
  const uuid =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}:${uuid}`;
};

const resolveTeamIdForInstallation = async (
  ctx: ActionCtx,
  installationId: number
) => {
  const conn = await ctx.runQuery(
    internal.github_app.getProviderConnectionByInstallationId,
    { installationId }
  );
  return conn?.teamId;
};

const recordCheckExecution = async (
  ctx: ActionCtx,
  args: UpsertExecutionArgs
) => {
  try {
    await ctx.runMutation(internal.github_checks.upsertExecutionFromEvent, args);
  } catch (_err) {
    // swallow to avoid retries; logging can be added later if needed
  }
};

const buildCheckSuiteArgs = (
  payload: CheckSuiteEvent,
  teamId: string,
  installationId: number
): UpsertExecutionArgs | null => {
  const repoFullName = nonEmpty(payload.repository?.full_name ?? undefined);
  const suite = payload.check_suite;
  const commitSha = nonEmpty(suite?.head_sha ?? undefined);
  if (!repoFullName || !commitSha || !suite) return null;
  const externalId = composeExternalId(
    "check_suite",
    suite.id,
    [commitSha, suite.app?.slug ?? undefined]
  );
  return {
    teamId,
    installationId,
    repoFullName,
    commitSha,
    type: "check_suite",
    externalId,
    name: nonEmpty(suite.app?.name ?? undefined) ?? nonEmpty(suite.app?.slug ?? undefined),
    status: suite.status ?? undefined,
    conclusion: suite.conclusion ?? undefined,
    detailsUrl: undefined,
    htmlUrl: undefined,
    description: undefined,
    context: undefined,
    appSlug: nonEmpty(suite.app?.slug ?? undefined),
    workflowName: undefined,
    workflowPath: undefined,
    jobName: undefined,
    runAttempt: undefined,
    checkSuiteId: optionalNumber(suite.id ?? undefined),
    workflowRunId: undefined,
    headBranch: nonEmpty(suite.head_branch ?? undefined),
    startedAt: parseIsoDate(suite.created_at ?? undefined),
    completedAt:
      suite.conclusion !== null && suite.conclusion !== undefined
        ? parseIsoDate(suite.updated_at ?? undefined)
        : undefined,
    eventAction: payload.action,
    eventTimestamp: parseIsoDate(suite.updated_at ?? undefined),
  };
};

const buildCheckRunArgs = (
  payload: CheckRunEvent,
  teamId: string,
  installationId: number
): UpsertExecutionArgs | null => {
  const repoFullName = nonEmpty(payload.repository?.full_name ?? undefined);
  const checkRun = payload.check_run;
  const commitSha = nonEmpty(checkRun?.head_sha ?? undefined);
  if (!repoFullName || !commitSha || !checkRun) return null;
  const externalId = composeExternalId("check_run", checkRun.id, [
    commitSha,
    checkRun.name ?? undefined,
  ]);
  const description = nonEmpty(checkRun.output?.summary ?? undefined);
  const headBranch = nonEmpty(checkRun.check_suite?.head_branch ?? undefined);
  return {
    teamId,
    installationId,
    repoFullName,
    commitSha,
    type: "check_run",
    externalId,
    name: nonEmpty(checkRun.name ?? undefined),
    status: checkRun.status ?? undefined,
    conclusion: checkRun.conclusion ?? undefined,
    detailsUrl: nonEmpty(checkRun.details_url ?? undefined),
    htmlUrl: nonEmpty(checkRun.html_url ?? undefined),
    description,
    context: nonEmpty(checkRun.external_id ?? undefined),
    appSlug: nonEmpty(checkRun.app?.slug ?? undefined),
    workflowName: undefined,
    workflowPath: undefined,
    jobName: undefined,
    runAttempt: optionalNumber(checkRun.run_attempt ?? undefined),
    checkSuiteId: optionalNumber(checkRun.check_suite?.id ?? undefined),
    workflowRunId: undefined,
    headBranch,
    startedAt: parseIsoDate(checkRun.started_at ?? undefined),
    completedAt: parseIsoDate(checkRun.completed_at ?? undefined),
    eventAction: payload.action,
    eventTimestamp:
      parseIsoDate(checkRun.completed_at ?? undefined) ??
      parseIsoDate(checkRun.started_at ?? undefined),
  };
};

const buildStatusArgs = (
  payload: StatusEvent,
  teamId: string,
  installationId: number
): UpsertExecutionArgs | null => {
  const repoFullName = nonEmpty(payload.repository?.full_name ?? undefined);
  const commitSha = nonEmpty(payload.sha ?? undefined);
  if (!repoFullName || !commitSha) return null;
  const context = nonEmpty(payload.context ?? undefined) ?? "default";
  const externalId = composeExternalId("status", payload.id, [
    commitSha,
    context,
  ]);
  const branchName = nonEmpty(payload.branches?.[0]?.name ?? undefined);
  return {
    teamId,
    installationId,
    repoFullName,
    commitSha,
    type: "status",
    externalId,
    name: context,
    status: payload.state,
    conclusion: undefined,
    detailsUrl: nonEmpty(payload.target_url ?? undefined),
    htmlUrl: nonEmpty(payload.target_url ?? undefined),
    description: nonEmpty(payload.description ?? undefined),
    context,
    appSlug: nonEmpty(payload.app?.slug ?? undefined),
    workflowName: undefined,
    workflowPath: undefined,
    jobName: undefined,
    runAttempt: undefined,
    checkSuiteId: undefined,
    workflowRunId: undefined,
    headBranch: branchName,
    startedAt: parseIsoDate(payload.created_at ?? undefined),
    completedAt: parseIsoDate(payload.updated_at ?? undefined),
    eventAction: payload.state,
    eventTimestamp: parseIsoDate(payload.updated_at ?? undefined),
  };
};

const buildWorkflowRunArgs = (
  payload: WorkflowRunEvent,
  teamId: string,
  installationId: number
): UpsertExecutionArgs | null => {
  const repoFullName = nonEmpty(payload.repository?.full_name ?? undefined);
  const run = payload.workflow_run;
  const commitSha = nonEmpty(run?.head_sha ?? undefined);
  if (!repoFullName || !commitSha || !run) return null;
  const externalId = composeExternalId("workflow_run", run.id, [
    commitSha,
    run.name ?? undefined,
  ]);
  return {
    teamId,
    installationId,
    repoFullName,
    commitSha,
    type: "workflow_run",
    externalId,
    name:
      nonEmpty(run.display_title ?? undefined) ?? nonEmpty(run.name ?? undefined),
    status: run.status ?? undefined,
    conclusion: run.conclusion ?? undefined,
    detailsUrl: nonEmpty(run.html_url ?? undefined),
    htmlUrl: nonEmpty(run.html_url ?? undefined),
    description: nonEmpty(run.display_title ?? undefined),
    context: nonEmpty(run.event ?? undefined),
    appSlug: undefined,
    workflowName: nonEmpty(run.name ?? undefined),
    workflowPath: nonEmpty(payload.workflow?.path ?? undefined),
    jobName: undefined,
    runAttempt: optionalNumber(run.run_attempt ?? undefined),
    checkSuiteId: undefined,
    workflowRunId: optionalNumber(run.id ?? undefined),
    headBranch: nonEmpty(run.head_branch ?? undefined),
    startedAt:
      parseIsoDate(run.run_started_at ?? undefined) ??
      parseIsoDate(run.created_at ?? undefined),
    completedAt: parseIsoDate(run.updated_at ?? undefined),
    eventAction: payload.action,
    eventTimestamp: parseIsoDate(run.updated_at ?? undefined),
  };
};

const buildWorkflowJobArgs = (
  payload: WorkflowJobEvent,
  teamId: string,
  installationId: number
): UpsertExecutionArgs | null => {
  const repoFullName = nonEmpty(payload.repository?.full_name ?? undefined);
  const job = payload.workflow_job;
  const commitSha = nonEmpty(job?.head_sha ?? undefined);
  if (!repoFullName || !commitSha || !job) return null;
  const externalId = composeExternalId("workflow_job", job.id, [
    commitSha,
    job.name ?? undefined,
    job.run_id ? String(job.run_id) : undefined,
  ]);
  const detailsUrl =
    nonEmpty(job.html_url ?? undefined) ??
    nonEmpty(job.url ?? undefined) ??
    nonEmpty(job.run_url ?? undefined);
  return {
    teamId,
    installationId,
    repoFullName,
    commitSha,
    type: "workflow_job",
    externalId,
    name: nonEmpty(job.name ?? undefined),
    status: job.status ?? undefined,
    conclusion: job.conclusion ?? undefined,
    detailsUrl,
    htmlUrl: nonEmpty(job.html_url ?? undefined),
    description: undefined,
    context: undefined,
    appSlug: undefined,
    workflowName: undefined,
    workflowPath: undefined,
    jobName: nonEmpty(job.name ?? undefined),
    runAttempt: optionalNumber(job.run_attempt ?? undefined),
    checkSuiteId: undefined,
    workflowRunId: optionalNumber(job.run_id ?? undefined),
    headBranch: nonEmpty(job.head_branch ?? undefined),
    startedAt: parseIsoDate(job.started_at ?? undefined),
    completedAt: parseIsoDate(job.completed_at ?? undefined),
    eventAction: payload.action,
    eventTimestamp:
      parseIsoDate(job.completed_at ?? undefined) ??
      parseIsoDate(job.started_at ?? undefined),
  };
};

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
        } else if (
          event === "check_suite" ||
          event === "check_run" ||
          event === "status" ||
          event === "workflow_run" ||
          event === "workflow_job"
        ) {
          try {
            const installation = Number(
              (body as WithInstallation).installation?.id ?? 0
            );
            if (!installation) break;
            const teamId = await resolveTeamIdForInstallation(
              _ctx,
              installation
            );
            if (!teamId) break;
            let args: UpsertExecutionArgs | null = null;
            if (event === "check_suite") {
              args = buildCheckSuiteArgs(body as CheckSuiteEvent, teamId, installation);
            } else if (event === "check_run") {
              args = buildCheckRunArgs(body as CheckRunEvent, teamId, installation);
            } else if (event === "status") {
              args = buildStatusArgs(body as StatusEvent, teamId, installation);
            } else if (event === "workflow_run") {
              args = buildWorkflowRunArgs(
                body as WorkflowRunEvent,
                teamId,
                installation
              );
            } else if (event === "workflow_job") {
              args = buildWorkflowJobArgs(
                body as WorkflowJobEvent,
                teamId,
                installation
              );
            }
            if (args) {
              await recordCheckExecution(_ctx, args);
            }
          } catch (_err) {
            // swallow
          }
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
