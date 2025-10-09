import type {
  CheckRunEvent,
  DeploymentEvent,
  DeploymentStatusEvent,
  StatusEvent,
  WorkflowRunEvent,
} from "@octokit/webhooks-types";
import { v, type Infer } from "convex/values";

// GitHub webhook payloads validator
// These match the structure from @octokit/webhooks-types
// We define minimal schemas for the fields we actually use

// Common user object in GitHub webhooks
const githubUser = v.object({
  login: v.optional(v.string()),
  id: v.optional(v.number()),
});

// Repository object
const githubRepository = v.object({
  id: v.optional(v.number()),
  pushed_at: v.optional(v.union(v.string(), v.number(), v.null())),
});

// Branch ref object
const githubBranchRef = v.object({
  ref: v.optional(v.string()),
  sha: v.optional(v.string()),
  repo: v.optional(v.union(githubRepository, v.null())),
});

// Pull request object from webhook
const githubPullRequest = v.object({
  number: v.optional(v.number()),
  id: v.optional(v.number()),
  title: v.optional(v.string()),
  state: v.optional(v.string()),
  merged: v.optional(v.union(v.boolean(), v.null())),
  draft: v.optional(v.union(v.boolean(), v.null())),
  html_url: v.optional(v.string()),
  merge_commit_sha: v.optional(v.union(v.string(), v.null())),
  created_at: v.optional(v.union(v.string(), v.null())),
  updated_at: v.optional(v.union(v.string(), v.null())),
  closed_at: v.optional(v.union(v.string(), v.null())),
  merged_at: v.optional(v.union(v.string(), v.null())),
  comments: v.optional(v.number()),
  review_comments: v.optional(v.number()),
  commits: v.optional(v.number()),
  additions: v.optional(v.number()),
  deletions: v.optional(v.number()),
  changed_files: v.optional(v.number()),
  user: v.optional(githubUser),
  base: v.optional(githubBranchRef),
  head: v.optional(githubBranchRef),
});

// Pull request webhook event
export const pullRequestWebhookPayload = v.object({
  pull_request: v.optional(githubPullRequest),
  number: v.optional(v.number()),
});

// App object for check runs
const githubApp = v.object({
  name: v.optional(v.string()),
  slug: v.optional(v.string()),
});

// Check run object
const githubCheckRun = v.object({
  id: v.optional(v.number()),
  name: v.optional(v.string()),
  head_sha: v.optional(v.string()),
  status: v.optional(v.string()),
  conclusion: v.optional(v.union(v.string(), v.null())),
  html_url: v.optional(v.string()),
  app: v.optional(githubApp),
  pull_requests: v.optional(v.array(v.object({
    number: v.optional(v.number()),
  }))),
  updated_at: v.optional(v.union(v.string(), v.null())),
  started_at: v.optional(v.union(v.string(), v.null())),
  completed_at: v.optional(v.union(v.string(), v.null())),
});

// Check run webhook event
export const checkRunWebhookPayload = v.object({
  check_run: v.optional(githubCheckRun),
  repository: v.optional(githubRepository),
});

// Workflow run object
const githubWorkflowRun = v.object({
  id: v.optional(v.number()),
  run_number: v.optional(v.number()),
  workflow_id: v.optional(v.number()),
  name: v.optional(v.string()),
  event: v.optional(v.string()),
  status: v.optional(v.string()),
  conclusion: v.optional(v.union(v.string(), v.null())),
  head_branch: v.optional(v.string()),
  head_sha: v.optional(v.string()),
  html_url: v.optional(v.string()),
  created_at: v.optional(v.string()),
  updated_at: v.optional(v.string()),
  run_started_at: v.optional(v.string()),
  completed_at: v.optional(v.union(v.string(), v.null())),
  actor: v.optional(githubUser),
  pull_requests: v.optional(v.array(v.object({
    number: v.optional(v.number()),
  }))),
});

// Workflow object
const githubWorkflow = v.object({
  name: v.optional(v.string()),
});

// Workflow run webhook event
export const workflowRunWebhookPayload = v.object({
  workflow_run: v.optional(githubWorkflowRun),
  workflow: v.optional(githubWorkflow),
  repository: v.optional(githubRepository),
});

// Deployment object
const githubDeployment = v.object({
  id: v.optional(v.number()),
  sha: v.optional(v.string()),
  ref: v.optional(v.string()),
  task: v.optional(v.string()),
  environment: v.optional(v.string()),
  description: v.optional(v.union(v.string(), v.null())),
  creator: v.optional(githubUser),
  created_at: v.optional(v.string()),
  updated_at: v.optional(v.string()),
});

// Deployment webhook event
export const deploymentWebhookPayload = v.object({
  deployment: v.optional(githubDeployment),
  repository: v.optional(githubRepository),
});

// Deployment status object
const githubDeploymentStatus = v.object({
  state: v.optional(v.string()),
  description: v.optional(v.union(v.string(), v.null())),
  log_url: v.optional(v.union(v.string(), v.null())),
  target_url: v.optional(v.union(v.string(), v.null())),
  environment_url: v.optional(v.union(v.string(), v.null())),
  updated_at: v.optional(v.string()),
});

// Deployment status webhook event
export const deploymentStatusWebhookPayload = v.object({
  deployment: v.optional(githubDeployment),
  deployment_status: v.optional(githubDeploymentStatus),
  repository: v.optional(githubRepository),
});

// Commit status webhook event (StatusEvent from @octokit/webhooks-types)
// Note: StatusEvent has top-level fields, not nested under 'status'
export const commitStatusWebhookPayload = v.object({
  id: v.optional(v.number()),
  sha: v.optional(v.string()),
  state: v.optional(v.string()),
  description: v.optional(v.union(v.string(), v.null())),
  target_url: v.optional(v.union(v.string(), v.null())),
  context: v.optional(v.string()),
  created_at: v.optional(v.string()),
  updated_at: v.optional(v.string()),
  repository: v.optional(githubRepository),
  sender: v.optional(githubUser),
});

export type GithubUserPayload = Infer<typeof githubUser>;
export type GithubRepositoryPayload = Infer<typeof githubRepository>;
export type GithubAppPayload = Infer<typeof githubApp>;
export type GithubCheckRunPayload = Infer<typeof githubCheckRun>;
export type GithubCheckRunEventPayload = Infer<typeof checkRunWebhookPayload>;
export type GithubWorkflowPayload = Infer<typeof githubWorkflow>;
export type GithubWorkflowRunPayload = Infer<typeof githubWorkflowRun>;
export type GithubWorkflowRunEventPayload = Infer<typeof workflowRunWebhookPayload>;
export type GithubDeploymentPayload = Infer<typeof githubDeployment>;
export type GithubDeploymentEventPayload = Infer<typeof deploymentWebhookPayload>;
export type GithubDeploymentStatusPayload = Infer<typeof githubDeploymentStatus>;
export type GithubDeploymentStatusEventPayload = Infer<
  typeof deploymentStatusWebhookPayload
>;
export type GithubCommitStatusEventPayload = Infer<typeof commitStatusWebhookPayload>;

type Maybe<T> = T | null | undefined;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const asStringOrNull = (value: unknown): string | null | undefined =>
  typeof value === "string"
    ? value
    : value === null
      ? null
      : undefined;

const sanitizeGithubUser = (
  user: Maybe<{ login?: unknown; id?: unknown }>,
): GithubUserPayload | undefined => {
  if (!isObject(user)) {
    return undefined;
  }

  const sanitized: GithubUserPayload = {};
  const login = asString(user.login);
  if (login !== undefined) sanitized.login = login;
  const id = asNumber(user.id);
  if (id !== undefined) sanitized.id = id;
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

const sanitizeGithubRepository = (
  repository: Maybe<{ id?: unknown; pushed_at?: unknown }>,
): GithubRepositoryPayload | undefined => {
  if (!isObject(repository)) {
    return undefined;
  }

  const sanitized: GithubRepositoryPayload = {};
  const id = asNumber(repository.id);
  if (id !== undefined) sanitized.id = id;
  const pushedAt = repository.pushed_at;
  if (
    typeof pushedAt === "string" ||
    typeof pushedAt === "number" ||
    pushedAt === null
  ) {
    sanitized.pushed_at = pushedAt;
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

const sanitizeGithubApp = (
  app: Maybe<{ name?: unknown; slug?: unknown }>,
): GithubAppPayload | undefined => {
  if (!isObject(app)) {
    return undefined;
  }

  const sanitized: GithubAppPayload = {};
  const name = asString(app.name);
  if (name !== undefined) sanitized.name = name;
  const slug = asString(app.slug);
  if (slug !== undefined) sanitized.slug = slug;
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

const sanitizePullRequests = (
  pullRequests: unknown,
): GithubCheckRunPayload["pull_requests"] => {
  if (!Array.isArray(pullRequests)) {
    return undefined;
  }

  const sanitized = pullRequests
    .map((item) => {
      if (!isObject(item)) {
        return undefined;
      }
      const prNumber = asNumber(item.number);
      return prNumber !== undefined ? { number: prNumber } : {};
    })
    .filter((item) => item !== undefined);

  return sanitized.length > 0 ? sanitized : undefined;
};

const sanitizeDeploymentPullRequests = (
  pullRequests: unknown,
): GithubWorkflowRunPayload["pull_requests"] => {
  if (!Array.isArray(pullRequests)) {
    return undefined;
  }

  const sanitized = pullRequests
    .map((item) => {
      if (!isObject(item)) {
        return undefined;
      }
      const prNumber = asNumber(item.number);
      return prNumber !== undefined ? { number: prNumber } : {};
    })
    .filter((item) => item !== undefined);

  return sanitized.length > 0 ? sanitized : undefined;
};

export const sanitizeCheckRunEvent = (
  event: CheckRunEvent,
): GithubCheckRunEventPayload => {
  const sanitized: GithubCheckRunEventPayload = {};

  if (event.check_run) {
    const checkRun: GithubCheckRunPayload = {};
    const id = asNumber(event.check_run.id);
    if (id !== undefined) checkRun.id = id;
    const name = asString(event.check_run.name);
    if (name !== undefined) checkRun.name = name;
    const headSha = asString(event.check_run.head_sha);
    if (headSha !== undefined) checkRun.head_sha = headSha;
    const status = asString(event.check_run.status);
    if (status !== undefined) checkRun.status = status;
    const conclusion = asStringOrNull(event.check_run.conclusion);
    if (conclusion !== undefined) checkRun.conclusion = conclusion;
    const htmlUrl = asString(event.check_run.html_url);
    if (htmlUrl !== undefined) checkRun.html_url = htmlUrl;
    const app = sanitizeGithubApp(event.check_run.app);
    if (app) checkRun.app = app;
    const pullRequests = sanitizePullRequests(event.check_run.pull_requests);
    if (pullRequests) checkRun.pull_requests = pullRequests;
    if ("updated_at" in event.check_run) {
      const updatedAt = asStringOrNull(
        (event.check_run as { updated_at?: unknown }).updated_at,
      );
      if (updatedAt !== undefined) checkRun.updated_at = updatedAt;
    }
    if ("started_at" in event.check_run) {
      const startedAt = asStringOrNull(
        (event.check_run as { started_at?: unknown }).started_at,
      );
      if (startedAt !== undefined) checkRun.started_at = startedAt;
    }
    if ("completed_at" in event.check_run) {
      const completedAt = asStringOrNull(
        (event.check_run as { completed_at?: unknown }).completed_at,
      );
      if (completedAt !== undefined) checkRun.completed_at = completedAt;
    }

    if (Object.keys(checkRun).length > 0) {
      sanitized.check_run = checkRun;
    }
  }

  const repository = sanitizeGithubRepository(event.repository);
  if (repository) {
    sanitized.repository = repository;
  }

  return sanitized;
};

const sanitizeGithubDeployment = (
  deployment: Maybe<DeploymentEvent["deployment"]>,
): GithubDeploymentPayload | undefined => {
  if (!isObject(deployment)) {
    return undefined;
  }

  const sanitized: GithubDeploymentPayload = {};
  const id = asNumber(deployment.id);
  if (id !== undefined) sanitized.id = id;
  const sha = asString(deployment.sha);
  if (sha !== undefined) sanitized.sha = sha;
  const ref = asString(deployment.ref);
  if (ref !== undefined) sanitized.ref = ref;
  const task = asString(deployment.task);
  if (task !== undefined) sanitized.task = task;
  const environment = asString(deployment.environment);
  if (environment !== undefined) sanitized.environment = environment;
  const description = asStringOrNull(deployment.description);
  if (description !== undefined) sanitized.description = description;
  const creator = sanitizeGithubUser(
    isObject(deployment.creator) ? deployment.creator : undefined,
  );
  if (creator) sanitized.creator = creator;
  const createdAt = asString(deployment.created_at);
  if (createdAt !== undefined) sanitized.created_at = createdAt;
  const updatedAt = asString(deployment.updated_at);
  if (updatedAt !== undefined) sanitized.updated_at = updatedAt;
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

const sanitizeGithubDeploymentStatus = (
  status: Maybe<DeploymentStatusEvent["deployment_status"]>,
): GithubDeploymentStatusPayload | undefined => {
  if (!isObject(status)) {
    return undefined;
  }

  const sanitized: GithubDeploymentStatusPayload = {};
  const state = asString(status.state);
  if (state !== undefined) sanitized.state = state;
  const description = asStringOrNull(status.description);
  if (description !== undefined) sanitized.description = description;
  const logUrl = asStringOrNull(status.log_url);
  if (logUrl !== undefined) sanitized.log_url = logUrl;
  const targetUrl = asStringOrNull(status.target_url);
  if (targetUrl !== undefined) sanitized.target_url = targetUrl;
  const environmentUrl = asStringOrNull(status.environment_url);
  if (environmentUrl !== undefined) sanitized.environment_url = environmentUrl;
  const updatedAt = asString(status.updated_at);
  if (updatedAt !== undefined) sanitized.updated_at = updatedAt;
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

export const sanitizeDeploymentEvent = (
  event: DeploymentEvent,
): GithubDeploymentEventPayload => {
  const sanitized: GithubDeploymentEventPayload = {};

  const deployment = sanitizeGithubDeployment(event.deployment);
  if (deployment) {
    sanitized.deployment = deployment;
  }

  const repository = sanitizeGithubRepository(event.repository);
  if (repository) {
    sanitized.repository = repository;
  }

  return sanitized;
};

export const sanitizeDeploymentStatusEvent = (
  event: DeploymentStatusEvent,
): GithubDeploymentStatusEventPayload => {
  const sanitized: GithubDeploymentStatusEventPayload = {};

  const deployment = sanitizeGithubDeployment(event.deployment);
  if (deployment) {
    sanitized.deployment = deployment;
  }

  const deploymentStatus = sanitizeGithubDeploymentStatus(event.deployment_status);
  if (deploymentStatus) {
    sanitized.deployment_status = deploymentStatus;
  }

  const repository = sanitizeGithubRepository(event.repository);
  if (repository) {
    sanitized.repository = repository;
  }

  return sanitized;
};

const sanitizeGithubWorkflowRun = (
  workflowRun: Maybe<WorkflowRunEvent["workflow_run"]>,
): GithubWorkflowRunPayload | undefined => {
  if (!isObject(workflowRun)) {
    return undefined;
  }

  const sanitized: GithubWorkflowRunPayload = {};
  const id = asNumber(workflowRun.id);
  if (id !== undefined) sanitized.id = id;
  const runNumber = asNumber(workflowRun.run_number);
  if (runNumber !== undefined) sanitized.run_number = runNumber;
  const workflowId = asNumber(workflowRun.workflow_id);
  if (workflowId !== undefined) sanitized.workflow_id = workflowId;
  const name = asString(workflowRun.name);
  if (name !== undefined) sanitized.name = name;
  const eventName = asString(workflowRun.event);
  if (eventName !== undefined) sanitized.event = eventName;
  const status = asString(workflowRun.status);
  if (status !== undefined) sanitized.status = status;
  const conclusion = asStringOrNull(workflowRun.conclusion);
  if (conclusion !== undefined) sanitized.conclusion = conclusion;
  const headBranch = asString(workflowRun.head_branch);
  if (headBranch !== undefined) sanitized.head_branch = headBranch;
  const headSha = asString(workflowRun.head_sha);
  if (headSha !== undefined) sanitized.head_sha = headSha;
  const htmlUrl = asString(workflowRun.html_url);
  if (htmlUrl !== undefined) sanitized.html_url = htmlUrl;
  const createdAt = asString(workflowRun.created_at);
  if (createdAt !== undefined) sanitized.created_at = createdAt;
  const updatedAt = asString(workflowRun.updated_at);
  if (updatedAt !== undefined) sanitized.updated_at = updatedAt;
  const runStartedAt = asString(workflowRun.run_started_at);
  if (runStartedAt !== undefined) sanitized.run_started_at = runStartedAt;
  const completedAt = asStringOrNull(workflowRun.completed_at);
  if (completedAt !== undefined) sanitized.completed_at = completedAt;
  const actor = sanitizeGithubUser(
    isObject(workflowRun.actor) ? workflowRun.actor : undefined,
  );
  if (actor) sanitized.actor = actor;
  const pullRequests = sanitizeDeploymentPullRequests(workflowRun.pull_requests);
  if (pullRequests !== undefined) sanitized.pull_requests = pullRequests;
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

const sanitizeGithubWorkflow = (
  workflow: Maybe<WorkflowRunEvent["workflow"]>,
): GithubWorkflowPayload | undefined => {
  if (!isObject(workflow)) {
    return undefined;
  }

  const sanitized: GithubWorkflowPayload = {};
  const name = asString(workflow.name);
  if (name !== undefined) sanitized.name = name;
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

export const sanitizeWorkflowRunEvent = (
  event: WorkflowRunEvent,
): GithubWorkflowRunEventPayload => {
  const sanitized: GithubWorkflowRunEventPayload = {};

  const workflowRun = sanitizeGithubWorkflowRun(event.workflow_run);
  if (workflowRun) {
    sanitized.workflow_run = workflowRun;
  }

  const workflow = sanitizeGithubWorkflow(event.workflow);
  if (workflow) {
    sanitized.workflow = workflow;
  }

  const repository = sanitizeGithubRepository(event.repository);
  if (repository) {
    sanitized.repository = repository;
  }

  return sanitized;
};

export const sanitizeCommitStatusEvent = (
  event: StatusEvent,
): GithubCommitStatusEventPayload => {
  const sanitized: GithubCommitStatusEventPayload = {};

  const id = asNumber(event.id);
  if (id !== undefined) sanitized.id = id;
  const sha = asString(event.sha);
  if (sha !== undefined) sanitized.sha = sha;
  const state = asString(event.state);
  if (state !== undefined) sanitized.state = state;
  const description = asStringOrNull(event.description);
  if (description !== undefined) sanitized.description = description;
  const targetUrl = asStringOrNull(event.target_url);
  if (targetUrl !== undefined) sanitized.target_url = targetUrl;
  const context = asString(event.context);
  if (context !== undefined) sanitized.context = context;
  const createdAt = asString(event.created_at);
  if (createdAt !== undefined) sanitized.created_at = createdAt;
  const updatedAt = asString(event.updated_at);
  if (updatedAt !== undefined) sanitized.updated_at = updatedAt;
  const repository = sanitizeGithubRepository(event.repository);
  if (repository) sanitized.repository = repository;
  const sender = sanitizeGithubUser(event.sender);
  if (sender) sanitized.sender = sender;

  return sanitized;
};
