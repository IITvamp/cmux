import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const convexSchema = defineSchema({
  users: defineTable({
    stackUserId: v.string(), // Stack Auth user ID
    email: v.string(),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_stackUserId", ["stackUserId"])
    .index("by_email", ["email"]),

  tasks: defineTable({
    text: v.string(),
    isCompleted: v.boolean(),
    isArchived: v.optional(v.boolean()),
    description: v.optional(v.string()),
    pullRequestTitle: v.optional(v.string()),
    pullRequestDescription: v.optional(v.string()),
    projectFullName: v.optional(v.string()),
    baseBranch: v.optional(v.string()),
    worktreePath: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    userId: v.optional(v.string()), // Link to user who created the task
    crownEvaluationError: v.optional(v.string()), // Error message if crown evaluation failed
    mergeStatus: v.optional(
      v.union(
        v.literal("none"), // No PR activity yet
        v.literal("pr_draft"), // PR created as draft
        v.literal("pr_open"), // PR opened and ready for review
        v.literal("pr_approved"), // PR has been approved
        v.literal("pr_changes_requested"), // PR has changes requested
        v.literal("pr_merged"), // PR has been merged
        v.literal("pr_closed") // PR closed without merging
      )
    ),
    images: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"), // Convex storage ID
          fileName: v.optional(v.string()),
          altText: v.string(),
        })
      )
    ),
  })
    .index("by_created", ["createdAt"])
    .index("by_user", ["userId", "createdAt"]),

  taskRuns: defineTable({
    taskId: v.id("tasks"),
    parentRunId: v.optional(v.id("taskRuns")), // For tree structure
    prompt: v.string(), // The prompt that will be passed to claude
    agentName: v.optional(v.string()), // Name of the agent that ran this task (e.g., "claude/sonnet-4")
    summary: v.optional(v.string()), // Markdown summary of the run
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    log: v.string(), // CLI output log, will be appended to in real-time
    worktreePath: v.optional(v.string()), // Path to the git worktree for this run
    newBranch: v.optional(v.string()), // The generated branch name for this run
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
    exitCode: v.optional(v.number()),
    errorMessage: v.optional(v.string()), // Error message when run fails early
    userId: v.optional(v.string()), // Link to user who created the run
    isCrowned: v.optional(v.boolean()), // Whether this run won the crown evaluation
    crownReason: v.optional(v.string()), // LLM's reasoning for why this run was crowned
    pullRequestUrl: v.optional(v.string()), // URL of the PR
    pullRequestIsDraft: v.optional(v.boolean()), // Whether the PR is a draft
    pullRequestState: v.optional(
      v.union(
        v.literal("none"), // no PR exists yet
        v.literal("draft"), // PR exists and is draft
        v.literal("open"), // PR exists and is open/ready for review
        v.literal("merged"), // PR merged
        v.literal("closed"), // PR closed without merge
        v.literal("unknown") // fallback/unsure
      )
    ),
    pullRequestNumber: v.optional(v.number()), // Numeric PR number on provider
    diffsLastUpdated: v.optional(v.number()), // Timestamp when diffs were last fetched/updated
    // VSCode instance information
    vscode: v.optional(
      v.object({
        provider: v.union(
          v.literal("docker"),
          v.literal("morph"),
          v.literal("daytona"),
          v.literal("other")
        ), // Extensible for future providers
        containerName: v.optional(v.string()), // For Docker provider
        status: v.union(
          v.literal("starting"),
          v.literal("running"),
          v.literal("stopped")
        ),
        ports: v.optional(
          v.object({
            vscode: v.string(),
            worker: v.string(),
            extension: v.optional(v.string()),
          })
        ),
        url: v.optional(v.string()), // The VSCode URL
        workspaceUrl: v.optional(v.string()), // The workspace URL
        startedAt: v.optional(v.number()),
        stoppedAt: v.optional(v.number()),
        lastAccessedAt: v.optional(v.number()), // Track when user last accessed the container
        keepAlive: v.optional(v.boolean()), // User requested to keep container running
        scheduledStopAt: v.optional(v.number()), // When container is scheduled to stop
      })
    ),
    networking: v.optional(
      v.array(
        v.object({
          status: v.union(
            v.literal("starting"),
            v.literal("running"),
            v.literal("stopped")
          ),
          port: v.number(),
          url: v.string(),
        })
      )
    ),
  })
    .index("by_task", ["taskId", "createdAt"])
    .index("by_parent", ["parentRunId"])
    .index("by_status", ["status"])
    .index("by_vscode_status", ["vscode.status"])
    .index("by_vscode_container_name", ["vscode.containerName"])
    .index("by_user", ["userId", "createdAt"]),
  taskVersions: defineTable({
    taskId: v.id("tasks"),
    version: v.number(),
    diff: v.string(),
    summary: v.string(),
    createdAt: v.number(),
    files: v.array(
      v.object({
        path: v.string(),
        changes: v.string(),
      })
    ),
  }).index("by_task", ["taskId", "version"]),
  repos: defineTable({
    fullName: v.string(),
    org: v.string(),
    name: v.string(),
    gitRemote: v.string(),
    provider: v.optional(v.string()), // e.g. "github", "gitlab", etc.
  })
    .index("by_org", ["org"])
    .index("by_gitRemote", ["gitRemote"]),
  branches: defineTable({
    repo: v.string(),
    name: v.string(),
  }).index("by_repo", ["repo"]),
  taskRunLogChunks: defineTable({
    taskRunId: v.id("taskRuns"),
    content: v.string(), // Log content chunk
  }).index("by_taskRun", ["taskRunId"]),
  apiKeys: defineTable({
    envVar: v.string(), // e.g. "GEMINI_API_KEY"
    value: v.string(), // The actual API key value (encrypted in a real app)
    displayName: v.string(), // e.g. "Gemini API Key"
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_envVar", ["envVar"]),
  workspaceSettings: defineTable({
    worktreePath: v.optional(v.string()), // Custom path for git worktrees
    autoPrEnabled: v.optional(v.boolean()), // Auto-create PR for crown winner (default: false)
    createdAt: v.number(),
    updatedAt: v.number(),
  }),
  crownEvaluations: defineTable({
    taskId: v.id("tasks"),
    evaluatedAt: v.number(),
    winnerRunId: v.id("taskRuns"),
    candidateRunIds: v.array(v.id("taskRuns")),
    evaluationPrompt: v.string(),
    evaluationResponse: v.string(),
    createdAt: v.number(),
  })
    .index("by_task", ["taskId"])
    .index("by_winner", ["winnerRunId"]),
  containerSettings: defineTable({
    maxRunningContainers: v.optional(v.number()), // Max containers to keep running (default: 5)
    reviewPeriodMinutes: v.optional(v.number()), // Minutes to keep container after task completion (default: 60)
    autoCleanupEnabled: v.optional(v.boolean()), // Enable automatic cleanup (default: true)
    stopImmediatelyOnCompletion: v.optional(v.boolean()), // Stop containers immediately when tasks complete (default: false)
    minContainersToKeep: v.optional(v.number()), // Minimum containers to always keep alive (default: 0)
    createdAt: v.number(),
    updatedAt: v.number(),
  }),
  
  comments: defineTable({
    url: v.string(), // Full URL of the website where comment was created
    page: v.string(), // Page URL/path where comment was created
    pageTitle: v.string(), // Page title for reference
    nodeId: v.string(), // CSS selector path to the element
    x: v.number(), // X position ratio within the element (0-1)
    y: v.number(), // Y position ratio within the element (0-1)
    content: v.string(), // Comment text content
    resolved: v.optional(v.boolean()), // Whether comment is resolved
    userId: v.string(), // User who created the comment
    userAgent: v.string(), // Browser user agent
    screenWidth: v.number(), // Screen width when comment was created
    screenHeight: v.number(), // Screen height when comment was created
    devicePixelRatio: v.number(), // Device pixel ratio
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_url", ["url", "createdAt"])
    .index("by_page", ["page", "createdAt"])
    .index("by_user", ["userId", "createdAt"])
    .index("by_resolved", ["resolved", "createdAt"]),
  
  commentReplies: defineTable({
    commentId: v.id("comments"),
    userId: v.string(),
    content: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_comment", ["commentId", "createdAt"])
    .index("by_user", ["userId", "createdAt"]),
});

export default convexSchema;
