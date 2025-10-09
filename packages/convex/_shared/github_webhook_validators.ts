import { v } from "convex/values";

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