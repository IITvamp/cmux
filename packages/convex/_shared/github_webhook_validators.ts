import type {
  CheckRunEvent,
  DeploymentEvent,
  DeploymentStatusEvent,
  PullRequestEvent,
  StatusEvent,
  WorkflowRunEvent,
} from "@octokit/webhooks-types";
import { v, type Infer } from "convex/values";

// Shared fragments ----------------------------------------------------------

const githubUser = v.object({
  login: v.optional(v.string()),
  id: v.optional(v.number()),
});
export type GithubUserFragment = Infer<typeof githubUser>;

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
export type PullRequestBranchFragment = Infer<typeof pullRequestBranchFragment>;

// Pull Request -------------------------------------------------------------

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
  user: v.optional(githubUser),
  base: v.optional(pullRequestBranchFragment),
  head: v.optional(pullRequestBranchFragment),
});

export const pullRequestWebhookPayload = v.object({
  pull_request: v.optional(pullRequestFragment),
  number: v.optional(v.number()),
});
export type GithubPullRequestEventPayload = Infer<
  typeof pullRequestWebhookPayload
>;

// Check Run ----------------------------------------------------------------

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

// Deployment ---------------------------------------------------------------

const deploymentFragment = v.object({
  id: v.optional(v.number()),
  sha: v.optional(v.string()),
  ref: v.optional(v.string()),
  task: v.optional(v.string()),
  environment: v.optional(v.string()),
  description: v.optional(v.string()),
  creator: v.optional(githubUser),
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

// Workflow Run -------------------------------------------------------------

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
  actor: v.optional(githubUser),
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

// Commit Status ------------------------------------------------------------

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
  sender: v.optional(githubUser),
});
export type GithubCommitStatusEventPayload = Infer<
  typeof commitStatusWebhookPayload
>;

// Convenience: type guard helpers (used only for type narrowing in other files)
export type CheckRunEventFragment = Pick<CheckRunEvent, "check_run" | "repository">;
export type DeploymentEventFragment = Pick<DeploymentEvent, "deployment" | "repository">;
export type DeploymentStatusEventFragment = Pick<
  DeploymentStatusEvent,
  "deployment" | "deployment_status" | "repository"
>;
export type WorkflowRunEventFragment = Pick<
  WorkflowRunEvent,
  "workflow_run" | "workflow" | "repository"
>;
export type CommitStatusEventFragment = Pick<
  StatusEvent,
  "id" | "sha" | "state" | "description" | "target_url" | "context" | "created_at" | "updated_at" | "repository" | "sender"
>;
export type PullRequestEventFragment = Pick<
  PullRequestEvent,
  "pull_request" | "number"
>;
