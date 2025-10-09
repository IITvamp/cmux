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
import type {
  PullRequestWebhookEnvelope,
  WebhookBranchRef,
  WebhookPullRequest,
  WebhookRepo,
  WebhookUser,
} from "./github_prs";

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

function mapNullable<T, R>(
  value: T | null | undefined,
  mapper: (value: T) => R,
): R | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return mapper(value);
}

function mapNullableOptional<T, R>(
  value: T | null | undefined,
  mapper: (value: T) => R,
): R | undefined {
  if (value === undefined || value === null) return undefined;
  return mapper(value);
}

type OctokitUserLike = {
  login?: string;
  id?: number;
  node_id?: string;
  avatar_url?: string;
  type?: string;
  site_admin?: boolean;
};

type OctokitRepoLike = {
  id?: number;
  node_id?: string;
  name?: string;
  full_name?: string;
  pushed_at?: string | number | null | undefined;
};

type OctokitBranchRefLike = {
  label?: string;
  ref?: string;
  sha?: string;
  user?: OctokitUserLike | null | undefined;
  repo?: OctokitRepoLike | null | undefined;
};

function sanitizeWebhookUser(
  user: OctokitUserLike | null | undefined,
): WebhookUser | null | undefined {
  return mapNullable(user, (value) => ({
    login: value.login,
    id: value.id,
    node_id: value.node_id,
    avatar_url: value.avatar_url,
    type: value.type,
    site_admin: value.site_admin,
  }));
}

function sanitizeWebhookRepo(
  repo: OctokitRepoLike | null | undefined,
): WebhookRepo | null | undefined {
  return mapNullable(repo, (value) => ({
    id: value.id,
    node_id: value.node_id,
    name: value.name,
    full_name: value.full_name,
    pushed_at: value.pushed_at,
  }));
}

function sanitizeWebhookBranchRef(
  branch: OctokitBranchRefLike | null | undefined,
): WebhookBranchRef | null | undefined {
  return mapNullable(branch, (value) => ({
    label: value.label,
    ref: value.ref,
    sha: value.sha,
    user: sanitizeWebhookUser(
      value.user === undefined ? undefined : value.user,
    ),
    repo: sanitizeWebhookRepo(value.repo),
  }));
}

function sanitizeWebhookPullRequest(
  pr: PullRequestEvent["pull_request"] | undefined,
): WebhookPullRequest | null | undefined {
  return mapNullable(pr, (value) => ({
    number: value.number,
    id: value.id,
    title: value.title,
    state: value.state,
    merged: value.merged,
    draft: value.draft,
    html_url: value.html_url,
    merge_commit_sha: value.merge_commit_sha,
    created_at: value.created_at,
    updated_at: value.updated_at,
    closed_at: value.closed_at,
    merged_at: value.merged_at,
    comments: value.comments,
    review_comments: value.review_comments,
    commits: value.commits,
    additions: value.additions,
    deletions: value.deletions,
    changed_files: value.changed_files,
    user: sanitizeWebhookUser(
      value.user === undefined ? undefined : value.user,
    ),
    base: sanitizeWebhookBranchRef(
      value.base === undefined ? undefined : value.base,
    ),
    head: sanitizeWebhookBranchRef(
      value.head === undefined ? undefined : value.head,
    ),
  }));
}

function sanitizePullRequestEventPayload(
  payload: PullRequestEvent,
): PullRequestWebhookEnvelope {
  const pullRequest = sanitizeWebhookPullRequest(payload.pull_request);
  return {
    number: payload.number,
    pull_request: pullRequest ?? undefined,
  };
}

type OctokitCheckRun = NonNullable<CheckRunEvent["check_run"]>;
type OctokitCheckRunPullRequest = OctokitCheckRun extends {
  pull_requests?: Array<infer PR>;
}
  ? PR
  : never;
type OctokitCheckRunBranchRef = OctokitCheckRunPullRequest extends {
  base?: infer B;
}
  ? NonNullable<B>
  : never;
type OctokitCheckRunRepoRef = OctokitCheckRunBranchRef extends {
  repo?: infer R;
}
  ? NonNullable<R>
  : never;
type OctokitCheckRunApp = OctokitCheckRun extends { app?: infer A }
  ? NonNullable<A>
  : never;
type OctokitCheckRunAppOwner = OctokitCheckRunApp extends { owner?: infer O }
  ? NonNullable<O>
  : never;
type OctokitCheckRunAppPermissions = OctokitCheckRunApp extends {
  permissions?: infer P;
}
  ? NonNullable<P>
  : never;
type OctokitCheckRunRepository = NonNullable<CheckRunEvent["repository"]>;
type OctokitCheckRunRepositoryOwner = OctokitCheckRunRepository extends {
  owner?: infer O;
}
  ? NonNullable<O>
  : never;

type OctokitSimpleRepository =
  | NonNullable<StatusEvent["repository"]>
  | NonNullable<DeploymentEvent["repository"]>
  | NonNullable<DeploymentStatusEvent["repository"]>;

type SanitizedCheckRunRepoRef = {
  id?: number;
  name?: string;
  url?: string;
};

type SanitizedCheckRunBranchRef = {
  ref?: string;
  sha?: string;
  repo?: SanitizedCheckRunRepoRef;
};

type SanitizedCheckRunPullRequest = {
  id?: number;
  number?: number;
  url?: string;
  head?: SanitizedCheckRunBranchRef;
  base?: SanitizedCheckRunBranchRef;
};

type SanitizedCheckRunAppOwner = {
  login?: string;
  id?: number;
  node_id?: string;
  avatar_url?: string;
  gravatar_id?: string;
  url?: string;
  html_url?: string;
  followers_url?: string;
  following_url?: string;
  gists_url?: string;
  starred_url?: string;
  subscriptions_url?: string;
  organizations_url?: string;
  repos_url?: string;
  events_url?: string;
  received_events_url?: string;
  type?: string;
  site_admin?: boolean;
  user_view_type?: string;
};

type SanitizedCheckRunAppPermissions = {
  actions?: string;
  administration?: string;
  checks?: string;
  contents?: string;
  deployments?: string;
  emails?: string;
  issues?: string;
  members?: string;
  metadata?: string;
  organization_hooks?: string;
  pull_requests?: string;
  repository_hooks?: string;
  statuses?: string;
};

type SanitizedCheckRunApp = {
  id?: number;
  slug?: string;
  node_id?: string;
  name?: string;
  description?: string | null;
  external_url?: string | null;
  html_url?: string;
  created_at?: string;
  updated_at?: string;
  events?: string[];
  owner?: SanitizedCheckRunAppOwner;
  permissions?: SanitizedCheckRunAppPermissions;
};

type SanitizedCheckRun = {
  id?: number;
  name?: string;
  head_sha?: string;
  status?: string;
  conclusion?: string | null;
  updated_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  html_url?: string;
  app?: SanitizedCheckRunApp;
  pull_requests?: SanitizedCheckRunPullRequest[];
};

type SanitizedCheckRunRepositoryOwner = {
  login?: string;
  id?: number;
  node_id?: string;
  avatar_url?: string;
  gravatar_id?: string;
  url?: string;
  html_url?: string;
  followers_url?: string;
  following_url?: string;
  gists_url?: string;
  starred_url?: string;
  subscriptions_url?: string;
  organizations_url?: string;
  repos_url?: string;
  events_url?: string;
  received_events_url?: string;
  type?: string;
  site_admin?: boolean;
  user_view_type?: string;
};

type SanitizedCheckRunRepository = {
  id?: number;
  node_id?: string;
  name?: string;
  full_name?: string;
  private?: boolean;
  owner?: SanitizedCheckRunRepositoryOwner;
  html_url?: string;
  description?: string | null;
  fork?: boolean;
  url?: string;
  ssh_url?: string;
  stargazers_count?: number;
  watchers_count?: number;
  size?: number;
  default_branch?: string;
  open_issues_count?: number;
  topics?: string[];
  pushed_at?: string | number | null;
  created_at?: string | number | null;
  updated_at?: string | number | null;
  allow_merge_commit?: boolean;
  allow_rebase_merge?: boolean;
  allow_squash_merge?: boolean;
  allow_auto_merge?: boolean;
  delete_branch_on_merge?: boolean;
  subscribers_count?: number;
  network_count?: number;
  forks?: number;
  open_issues?: number;
  watchers?: number;
  allow_forking?: boolean;
  web_commit_signoff_required?: boolean;
};

type SanitizedCheckRunPayload = {
  check_run?: SanitizedCheckRun;
  repository?: SanitizedCheckRunRepository;
};

function sanitizeCheckRunRepoRef(
  repo: OctokitCheckRunRepoRef | null | undefined,
): SanitizedCheckRunRepoRef | undefined {
  return mapNullableOptional(repo, (value) => ({
    id: value.id,
    name: value.name,
    url: value.url,
  }));
}

function sanitizeCheckRunBranchRef(
  ref: OctokitCheckRunBranchRef | null | undefined,
): SanitizedCheckRunBranchRef | undefined {
  return mapNullableOptional(ref, (value) => ({
    ref: value.ref,
    sha: value.sha,
    repo: sanitizeCheckRunRepoRef(value.repo ?? undefined),
  }));
}

function sanitizeCheckRunPullRequest(
  pr: OctokitCheckRunPullRequest | null | undefined,
): SanitizedCheckRunPullRequest | undefined {
  return mapNullableOptional(pr, (value) => ({
    id: value.id,
    number: value.number,
    url: value.url,
    head: sanitizeCheckRunBranchRef(value.head ?? undefined),
    base: sanitizeCheckRunBranchRef(value.base ?? undefined),
  }));
}

function sanitizeCheckRunAppOwner(
  owner: OctokitCheckRunAppOwner | null | undefined,
): SanitizedCheckRunAppOwner | undefined {
  return mapNullableOptional(owner, (value) => ({
    login: value.login,
    id: value.id,
    node_id: value.node_id,
    avatar_url: value.avatar_url,
    gravatar_id: value.gravatar_id,
    url: value.url,
    html_url: value.html_url,
    followers_url: value.followers_url,
    following_url: value.following_url,
    gists_url: value.gists_url,
    starred_url: value.starred_url,
    subscriptions_url: value.subscriptions_url,
    organizations_url: value.organizations_url,
    repos_url: value.repos_url,
    events_url: value.events_url,
    received_events_url: value.received_events_url,
    type: value.type,
    site_admin: value.site_admin,
  }));
}

function sanitizeCheckRunAppPermissions(
  permissions: OctokitCheckRunAppPermissions | null | undefined,
): SanitizedCheckRunAppPermissions | undefined {
  return mapNullableOptional(permissions, (value) => ({
    actions: value.actions,
    administration: value.administration,
    checks: value.checks,
    contents: value.contents,
    deployments: value.deployments,
    emails: value.emails,
    issues: value.issues,
    members: value.members,
    metadata: value.metadata,
    organization_hooks: value.organization_hooks,
    pull_requests: value.pull_requests,
    repository_hooks: value.repository_hooks,
    statuses: value.statuses,
  }));
}

function sanitizeCheckRunApp(
  app: OctokitCheckRunApp | null | undefined,
): SanitizedCheckRunApp | undefined {
  return mapNullableOptional(app, (value) => ({
    id: value.id,
    slug: value.slug,
    node_id: value.node_id,
    name: value.name,
    description: value.description ?? null,
    external_url: value.external_url ?? null,
    html_url: value.html_url,
    created_at: value.created_at,
    updated_at: value.updated_at,
    events: Array.isArray(value.events) ? [...value.events] : undefined,
    owner: sanitizeCheckRunAppOwner(value.owner ?? undefined),
    permissions: sanitizeCheckRunAppPermissions(value.permissions ?? undefined),
  }));
}

function sanitizeCheckRunRepositoryOwner(
  owner: OctokitCheckRunRepositoryOwner | null | undefined,
): SanitizedCheckRunRepositoryOwner | undefined {
  return mapNullableOptional(owner, (value) => ({
    login: value.login,
    id: value.id,
    node_id: value.node_id,
    avatar_url: value.avatar_url,
    gravatar_id: value.gravatar_id,
    url: value.url,
    html_url: value.html_url,
    followers_url: value.followers_url,
    following_url: value.following_url,
    gists_url: value.gists_url,
    starred_url: value.starred_url,
    subscriptions_url: value.subscriptions_url,
    organizations_url: value.organizations_url,
    repos_url: value.repos_url,
    events_url: value.events_url,
    received_events_url: value.received_events_url,
    type: value.type,
    site_admin: value.site_admin,
  }));
}

function sanitizeCheckRunRepository(
  repo: CheckRunEvent["repository"] | null | undefined,
): SanitizedCheckRunRepository | undefined {
  return mapNullableOptional(repo, (value) => ({
    id: value.id,
    node_id: value.node_id,
    name: value.name,
    full_name: value.full_name,
    private: value.private,
    owner: sanitizeCheckRunRepositoryOwner(value.owner ?? undefined),
    html_url: value.html_url,
    description: value.description ?? null,
    fork: value.fork,
    url: value.url,
    ssh_url: value.ssh_url,
    stargazers_count: value.stargazers_count,
    watchers_count: value.watchers_count,
    size: value.size,
    default_branch: value.default_branch,
    open_issues_count: value.open_issues_count,
    topics: Array.isArray(value.topics) ? [...value.topics] : undefined,
    pushed_at: value.pushed_at,
    created_at: value.created_at,
    updated_at: value.updated_at,
    allow_merge_commit: value.allow_merge_commit,
    allow_rebase_merge: value.allow_rebase_merge,
    allow_squash_merge: value.allow_squash_merge,
    allow_auto_merge: value.allow_auto_merge,
    delete_branch_on_merge: value.delete_branch_on_merge,
    forks: value.forks,
    open_issues: value.open_issues,
    watchers: value.watchers,
    allow_forking: value.allow_forking,
    web_commit_signoff_required: value.web_commit_signoff_required,
  }));
}

function sanitizeCheckRunEventPayload(payload: CheckRunEvent): SanitizedCheckRunPayload {
  const sanitizedCheckRun = mapNullableOptional(payload.check_run, (checkRun) => ({
    id: checkRun.id,
    name: checkRun.name,
    head_sha: checkRun.head_sha,
    status: checkRun.status,
    conclusion: checkRun.conclusion ?? null,
    updated_at: (checkRun as { updated_at?: string | null }).updated_at ?? null,
    started_at: checkRun.started_at ?? null,
    completed_at: checkRun.completed_at ?? null,
    html_url: checkRun.html_url,
    app: sanitizeCheckRunApp(checkRun.app ?? undefined),
    pull_requests: Array.isArray(checkRun.pull_requests)
      ? checkRun.pull_requests
          .map((pr) => sanitizeCheckRunPullRequest(pr))
          .filter((pr): pr is SanitizedCheckRunPullRequest => pr !== undefined)
      : undefined,
  }));

  if (sanitizedCheckRun && "check_suite" in (sanitizedCheckRun as Record<string, unknown>)) {
    delete (sanitizedCheckRun as Record<string, unknown>).check_suite;
  }

  const sanitizedRepository = sanitizeCheckRunRepository(
    payload.repository ?? undefined,
  );

  return {
    check_run: sanitizedCheckRun,
    repository: sanitizedRepository,
  };
}

function sanitizeSimpleRepository(
  repo: OctokitSimpleRepository | null | undefined,
): OctokitSimpleRepository | undefined {
  if (repo === null || repo === undefined) return undefined;
  return {
    id: repo.id,
    node_id: repo.node_id,
    name: repo.name,
    full_name: repo.full_name,
  } as OctokitSimpleRepository;
}

function sanitizeCommitStatusEventPayload(payload: StatusEvent): StatusEvent {
  const repository = sanitizeSimpleRepository(payload.repository ?? undefined);
  return {
    ...payload,
    repository: (repository ?? payload.repository) as StatusEvent["repository"],
  } as StatusEvent;
}

type OctokitDeploymentInfo = DeploymentEvent["deployment"];
type OctokitDeploymentStatusInfo = DeploymentStatusEvent["deployment_status"];

function sanitizeDeploymentInfo(
  deployment: OctokitDeploymentInfo | null | undefined,
): OctokitDeploymentInfo | undefined {
  if (!deployment) return undefined;
  return {
    id: deployment.id,
    sha: deployment.sha,
    created_at: deployment.created_at,
    updated_at: deployment.updated_at,
    ref: deployment.ref,
    task: deployment.task,
    environment: deployment.environment,
    description: deployment.description,
    creator: deployment.creator
      ? {
          login: deployment.creator.login,
          id: deployment.creator.id,
          node_id: deployment.creator.node_id,
          avatar_url: deployment.creator.avatar_url,
          type: deployment.creator.type,
          site_admin: deployment.creator.site_admin,
        }
      : undefined,
  } as OctokitDeploymentInfo;
}

function sanitizeDeploymentStatusInfo(
  status: OctokitDeploymentStatusInfo | null | undefined,
): OctokitDeploymentStatusInfo | undefined {
  if (!status) return undefined;
  return {
    state: status.state,
    updated_at: status.updated_at,
    description: status.description,
    log_url: status.log_url,
    target_url: status.target_url,
    environment_url: status.environment_url,
  } as OctokitDeploymentStatusInfo;
}

function sanitizeDeploymentEventPayload(payload: DeploymentEvent): DeploymentEvent {
  const repository = sanitizeSimpleRepository(payload.repository ?? undefined);
  const deployment = sanitizeDeploymentInfo(payload.deployment);
  return {
    ...payload,
    deployment: (deployment ?? payload.deployment) as DeploymentEvent["deployment"],
    repository: (repository ?? payload.repository) as DeploymentEvent["repository"],
  } as DeploymentEvent;
}

function sanitizeDeploymentStatusEventPayload(
  payload: DeploymentStatusEvent,
): DeploymentStatusEvent {
  const repository = sanitizeSimpleRepository(payload.repository ?? undefined);
  const deployment = sanitizeDeploymentInfo(payload.deployment);
  const deploymentStatus = sanitizeDeploymentStatusInfo(payload.deployment_status);
  return {
    ...payload,
    deployment: (deployment ?? payload.deployment) as DeploymentStatusEvent["deployment"],
    deployment_status: (deploymentStatus ?? payload.deployment_status) as DeploymentStatusEvent["deployment_status"],
    repository: (repository ?? payload.repository) as DeploymentStatusEvent["repository"],
  } as DeploymentStatusEvent;
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
              payload: workflowRunPayload,
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
            payload: sanitizeCheckRunEventPayload(checkRunPayload),
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
              payload: sanitizeDeploymentEventPayload(deploymentPayload),
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
              payload: sanitizeDeploymentStatusEventPayload(deploymentStatusPayload),
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
              payload: sanitizeCommitStatusEventPayload(statusPayload),
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
            payload: sanitizePullRequestEventPayload(prPayload),
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
