import type {
  CheckRunEvent,
  DeploymentEvent,
  DeploymentStatusEvent,
  PullRequestEvent,
  StatusEvent,
  WorkflowRunEvent,
} from "@octokit/webhooks-types";
import { v, type Infer } from "convex/values";

const pickString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const pickNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const pickBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const githubUserFragment = v.object({
  login: v.optional(v.string()),
  id: v.optional(v.number()),
});
export type GithubUserFragment = Infer<typeof githubUserFragment>;

const githubRepositoryFragment = v.object({
  id: v.optional(v.number()),
  pushed_at: v.optional(v.string()),
});
export type GithubRepositoryFragment = Infer<typeof githubRepositoryFragment>;

const pullRequestBranchFragment = v.object({
  ref: v.optional(v.string()),
  sha: v.optional(v.string()),
  repo: v.optional(githubRepositoryFragment),
});
type PullRequestBranchFragment = Infer<typeof pullRequestBranchFragment>;

const pullRequestFragment = v.object({
  number: v.optional(v.number()),
  id: v.optional(v.number()),
  title: v.optional(v.string()),
  state: v.optional(v.string()),
  merged: v.optional(v.boolean()),
  draft: v.optional(v.boolean()),
  html_url: v.optional(v.string()),
  merge_commit_sha: v.optional(v.string()),
  created_at: v.optional(v.string()),
  updated_at: v.optional(v.string()),
  closed_at: v.optional(v.string()),
  merged_at: v.optional(v.string()),
  comments: v.optional(v.number()),
  review_comments: v.optional(v.number()),
  commits: v.optional(v.number()),
  additions: v.optional(v.number()),
  deletions: v.optional(v.number()),
  changed_files: v.optional(v.number()),
  user: v.optional(githubUserFragment),
  base: v.optional(pullRequestBranchFragment),
  head: v.optional(pullRequestBranchFragment),
});
type PullRequestFragment = Infer<typeof pullRequestFragment>;

export const pullRequestWebhookPayload = v.object({
  pull_request: v.optional(pullRequestFragment),
  number: v.optional(v.number()),
});
export type GithubPullRequestEventPayload = Infer<
  typeof pullRequestWebhookPayload
>;

const checkRunFragment = v.object({
  id: v.optional(v.number()),
  name: v.optional(v.string()),
  head_sha: v.optional(v.string()),
  status: v.optional(v.string()),
  conclusion: v.optional(v.string()),
  html_url: v.optional(v.string()),
  app: v.optional(
    v.object({
      name: v.optional(v.string()),
      slug: v.optional(v.string()),
    }),
  ),
  pull_requests: v.optional(
    v.array(
      v.object({
        number: v.optional(v.number()),
      }),
    ),
  ),
  updated_at: v.optional(v.string()),
  started_at: v.optional(v.string()),
  completed_at: v.optional(v.string()),
});

export const checkRunWebhookPayload = v.object({
  check_run: v.optional(checkRunFragment),
  repository: v.optional(githubRepositoryFragment),
});
export type GithubCheckRunEventPayload = Infer<
  typeof checkRunWebhookPayload
>;

const deploymentFragment = v.object({
  id: v.optional(v.number()),
  sha: v.optional(v.string()),
  ref: v.optional(v.string()),
  task: v.optional(v.string()),
  environment: v.optional(v.string()),
  description: v.optional(v.string()),
  creator: v.optional(githubUserFragment),
  created_at: v.optional(v.string()),
  updated_at: v.optional(v.string()),
});

export const deploymentWebhookPayload = v.object({
  deployment: v.optional(deploymentFragment),
  repository: v.optional(githubRepositoryFragment),
});
export type GithubDeploymentEventPayload = Infer<
  typeof deploymentWebhookPayload
>;

const deploymentStatusFragment = v.object({
  state: v.optional(v.string()),
  description: v.optional(v.string()),
  log_url: v.optional(v.string()),
  target_url: v.optional(v.string()),
  environment_url: v.optional(v.string()),
  updated_at: v.optional(v.string()),
});

export const deploymentStatusWebhookPayload = v.object({
  deployment: v.optional(deploymentFragment),
  deployment_status: v.optional(deploymentStatusFragment),
  repository: v.optional(githubRepositoryFragment),
});
export type GithubDeploymentStatusEventPayload = Infer<
  typeof deploymentStatusWebhookPayload
>;

const workflowRunFragment = v.object({
  id: v.optional(v.number()),
  run_number: v.optional(v.number()),
  workflow_id: v.optional(v.number()),
  name: v.optional(v.string()),
  event: v.optional(v.string()),
  status: v.optional(v.string()),
  conclusion: v.optional(v.string()),
  head_branch: v.optional(v.string()),
  head_sha: v.optional(v.string()),
  html_url: v.optional(v.string()),
  created_at: v.optional(v.string()),
  updated_at: v.optional(v.string()),
  run_started_at: v.optional(v.string()),
  completed_at: v.optional(v.string()),
  actor: v.optional(githubUserFragment),
  pull_requests: v.optional(
    v.array(
      v.object({
        number: v.optional(v.number()),
      }),
    ),
  ),
});

const workflowFragment = v.object({
  name: v.optional(v.string()),
});

export const workflowRunWebhookPayload = v.object({
  workflow_run: v.optional(workflowRunFragment),
  workflow: v.optional(workflowFragment),
  repository: v.optional(githubRepositoryFragment),
});
export type GithubWorkflowRunEventPayload = Infer<
  typeof workflowRunWebhookPayload
>;

export const commitStatusWebhookPayload = v.object({
  id: v.optional(v.number()),
  sha: v.optional(v.string()),
  state: v.optional(v.string()),
  description: v.optional(v.string()),
  target_url: v.optional(v.string()),
  context: v.optional(v.string()),
  created_at: v.optional(v.string()),
  updated_at: v.optional(v.string()),
  repository: v.optional(githubRepositoryFragment),
  sender: v.optional(githubUserFragment),
});
export type GithubCommitStatusEventPayload = Infer<
  typeof commitStatusWebhookPayload
>;

function mapRepository(repo: unknown): GithubRepositoryFragment | undefined {
  if (!repo || typeof repo !== "object") {
    return undefined;
  }
  const objectRepo = repo as Record<string, unknown>;
  const result: GithubRepositoryFragment = {};
  const id = pickNumber(objectRepo.id);
  if (id !== undefined) result.id = id;
  const pushedAt = objectRepo.pushed_at;
  if (typeof pushedAt === "string") {
    result.pushed_at = pushedAt;
  } else if (typeof pushedAt === "number" && Number.isFinite(pushedAt)) {
    result.pushed_at = pushedAt.toString();
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function mapBranchRef(
  refValue: unknown,
): PullRequestBranchFragment | undefined {
  if (!refValue || typeof refValue !== "object") {
    return undefined;
  }
  const value = refValue as Record<string, unknown>;
  const result: PullRequestBranchFragment = {};
  const ref = pickString(value.ref);
  if (ref !== undefined) result.ref = ref;
  const sha = pickString(value.sha);
  if (sha !== undefined) result.sha = sha;
  const repo = mapRepository(value.repo);
  if (repo) result.repo = repo;
  return Object.keys(result).length > 0 ? result : undefined;
}

function mapPullRequest(pr: unknown): PullRequestFragment | undefined {
  if (!pr || typeof pr !== "object") {
    return undefined;
  }
  const value = pr as Record<string, unknown>;
  const result: PullRequestFragment = {};
  const number = pickNumber(value.number);
  if (number !== undefined) result.number = number;
  const id = pickNumber(value.id);
  if (id !== undefined) result.id = id;
  const title = pickString(value.title);
  if (title !== undefined) result.title = title;
  const state = pickString(value.state);
  if (state !== undefined) result.state = state;
  const merged = pickBoolean(value.merged);
  if (merged !== undefined) result.merged = merged;
  const draft = pickBoolean(value.draft);
  if (draft !== undefined) result.draft = draft;
  const htmlUrl = pickString(value.html_url);
  if (htmlUrl !== undefined) result.html_url = htmlUrl;
  const mergeCommitSha = pickString(value.merge_commit_sha);
  if (mergeCommitSha !== undefined) result.merge_commit_sha = mergeCommitSha;
  const createdAt = pickString(value.created_at);
  if (createdAt !== undefined) result.created_at = createdAt;
  const updatedAt = pickString(value.updated_at);
  if (updatedAt !== undefined) result.updated_at = updatedAt;
  const closedAt = pickString(value.closed_at);
  if (closedAt !== undefined) result.closed_at = closedAt;
  const mergedAt = pickString(value.merged_at);
  if (mergedAt !== undefined) result.merged_at = mergedAt;
  const comments = pickNumber(value.comments);
  if (comments !== undefined) result.comments = comments;
  const reviewComments = pickNumber(value.review_comments);
  if (reviewComments !== undefined) result.review_comments = reviewComments;
  const commits = pickNumber(value.commits);
  if (commits !== undefined) result.commits = commits;
  const additions = pickNumber(value.additions);
  if (additions !== undefined) result.additions = additions;
  const deletions = pickNumber(value.deletions);
  if (deletions !== undefined) result.deletions = deletions;
  const changedFiles = pickNumber(value.changed_files);
  if (changedFiles !== undefined) result.changed_files = changedFiles;
  const user = mapUser(value.user);
  if (user) result.user = user;
  const base = mapBranchRef(value.base);
  if (base) result.base = base;
  const head = mapBranchRef(value.head);
  if (head) result.head = head;
  return Object.keys(result).length > 0 ? result : undefined;
}

function mapUser(user: unknown): GithubUserFragment | undefined {
  if (!user || typeof user !== "object") {
    return undefined;
  }
  const value = user as Record<string, unknown>;
  const result: GithubUserFragment = {};
  const login = pickString(value.login);
  if (login !== undefined) result.login = login;
  const id = pickNumber(value.id);
  if (id !== undefined) result.id = id;
  return Object.keys(result).length > 0 ? result : undefined;
}

function mapCheckRun(event: CheckRunEvent): GithubCheckRunEventPayload {
  const payload: GithubCheckRunEventPayload = {};
  const checkRun = event.check_run as Record<string, unknown> | undefined;
  if (checkRun) {
    const mapped = {
      id: pickNumber(checkRun.id),
      name: pickString(checkRun.name),
      head_sha: pickString(checkRun.head_sha),
      status: pickString(checkRun.status),
      conclusion: pickString(checkRun.conclusion),
      html_url: pickString(checkRun.html_url),
      app: (checkRun.app as Record<string, unknown> | undefined)
        ? {
            name: pickString((checkRun.app as Record<string, unknown>).name),
            slug: pickString((checkRun.app as Record<string, unknown>).slug),
          }
        : undefined,
      pull_requests: Array.isArray(checkRun.pull_requests)
        ? (checkRun.pull_requests as unknown[])
            .map((pr) => ({ number: pickNumber((pr as any)?.number) }))
            .filter((pr) => pr.number !== undefined)
        : undefined,
      updated_at: pickString(checkRun.updated_at),
      started_at: pickString(checkRun.started_at),
      completed_at: pickString(checkRun.completed_at),
    };
    payload.check_run = Object.fromEntries(
      Object.entries(mapped).filter(([, v]) => v !== undefined),
    ) as GithubCheckRunEventPayload["check_run"];
  }

  const repo = mapRepository(event.repository);
  if (repo) payload.repository = repo;
  return payload;
}

function mapDeployment(event: DeploymentEvent): GithubDeploymentEventPayload {
  const payload: GithubDeploymentEventPayload = {};
  const deployment = (event.deployment as unknown) as
    | Record<string, unknown>
    | undefined;
  if (deployment) {
    const mapped = {
      id: pickNumber(deployment.id),
      sha: pickString(deployment.sha),
      ref: pickString(deployment.ref),
      task: pickString(deployment.task),
      environment: pickString(deployment.environment),
      description: pickString(
        (deployment.description ?? undefined) as unknown,
      ),
      creator: mapUser(deployment.creator),
      created_at: pickString(deployment.created_at),
      updated_at: pickString(deployment.updated_at),
    };
    payload.deployment = Object.fromEntries(
      Object.entries(mapped).filter(([, v]) => v !== undefined),
    ) as GithubDeploymentEventPayload["deployment"];
  }
  const repo = mapRepository(event.repository);
  if (repo) payload.repository = repo;
  return payload;
}

function mapDeploymentStatus(
  event: DeploymentStatusEvent,
): GithubDeploymentStatusEventPayload {
  const base = mapDeployment(event as unknown as DeploymentEvent);
  const payload: GithubDeploymentStatusEventPayload = {
    ...base,
  };
  const status = (event.deployment_status as unknown) as
    | Record<string, unknown>
    | undefined;
  if (status) {
    const mapped = {
      state: pickString(status.state),
      description: pickString((status.description ?? undefined) as unknown),
      log_url: pickString(status.log_url),
      target_url: pickString(status.target_url),
      environment_url: pickString(status.environment_url),
      updated_at: pickString(status.updated_at),
    };
    (payload as any).deployment_status = Object.fromEntries(
      Object.entries(mapped).filter(([, v]) => v !== undefined),
    );
  }
  return payload;
}

function mapWorkflowRun(
  event: WorkflowRunEvent,
): GithubWorkflowRunEventPayload {
  const payload: GithubWorkflowRunEventPayload = {};
  const run = (event.workflow_run as unknown) as
    | Record<string, unknown>
    | undefined;
  if (run) {
    const mapped = {
      id: pickNumber(run.id),
      run_number: pickNumber(run.run_number),
      workflow_id: pickNumber(run.workflow_id),
      name: pickString(run.name),
      event: pickString(run.event),
      status: pickString(run.status),
      conclusion: pickString((run.conclusion ?? undefined) as unknown),
      head_branch: pickString(run.head_branch),
      head_sha: pickString(run.head_sha),
      html_url: pickString(run.html_url),
      created_at: pickString(run.created_at),
      updated_at: pickString(run.updated_at),
      run_started_at: pickString(run.run_started_at),
      completed_at: pickString(run.completed_at),
      actor: mapUser(run.actor),
      pull_requests: Array.isArray(run.pull_requests)
        ? (run.pull_requests as unknown[])
            .map((pr) => ({ number: pickNumber((pr as any)?.number) }))
            .filter((pr) => pr.number !== undefined)
        : undefined,
    };
    payload.workflow_run = Object.fromEntries(
      Object.entries(mapped).filter(([, v]) => v !== undefined),
    ) as GithubWorkflowRunEventPayload["workflow_run"];
  }
  const workflow = (event.workflow as unknown) as
    | Record<string, unknown>
    | undefined;
  if (workflow && typeof workflow === "object") {
    const name = pickString(workflow.name);
    if (name !== undefined) payload.workflow = { name };
  }
  const repo = mapRepository(event.repository);
  if (repo) payload.repository = repo;
  return payload;
}

function mapCommitStatus(event: StatusEvent): GithubCommitStatusEventPayload {
  const payload: GithubCommitStatusEventPayload = {
    id: pickNumber((event as any).id),
    sha: pickString(event.sha),
    state: pickString(event.state),
    description: pickString(event.description ?? undefined),
    target_url: pickString(event.target_url ?? undefined),
    context: pickString(event.context),
    created_at: pickString(event.created_at),
    updated_at: pickString(event.updated_at),
  };
  const repo = mapRepository(event.repository);
  if (repo) payload.repository = repo;
  const sender = mapUser(event.sender);
  if (sender) payload.sender = sender;
  return Object.fromEntries(
    Object.entries(payload).filter(([, v]) => v !== undefined),
  ) as GithubCommitStatusEventPayload;
}

export function buildPullRequestPayload(
  event: PullRequestEvent,
): GithubPullRequestEventPayload {
  const payload: GithubPullRequestEventPayload = {};
  const pullRequest = mapPullRequest(event.pull_request);
  if (pullRequest) payload.pull_request = pullRequest;
  const number = pickNumber((event as any).number);
  if (number !== undefined) payload.number = number;
  return payload;
}

export { mapCheckRun as buildCheckRunPayload };
export { mapDeployment as buildDeploymentPayload };
export { mapDeploymentStatus as buildDeploymentStatusPayload };
export { mapWorkflowRun as buildWorkflowRunPayload };
export { mapCommitStatus as buildCommitStatusPayload };
