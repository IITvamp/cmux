import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tasks: defineTable({
    text: v.string(),
    isCompleted: v.boolean(),
    isArchived: v.optional(v.boolean()),
    description: v.optional(v.string()),
    projectFullName: v.optional(v.string()),
    branch: v.optional(v.string()),
    worktreePath: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  }).index("by_created", ["createdAt"]),
  taskRuns: defineTable({
    taskId: v.id("tasks"),
    parentRunId: v.optional(v.id("taskRuns")), // For tree structure
    prompt: v.string(), // The prompt that will be passed to claude
    summary: v.optional(v.string()), // Markdown summary of the run
    status: v.union(v.literal("pending"), v.literal("running"), v.literal("completed"), v.literal("failed")),
    log: v.string(), // CLI output log, will be appended to in real-time
    worktreePath: v.optional(v.string()), // Path to the git worktree for this run
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
    exitCode: v.optional(v.number()),
  })
    .index("by_task", ["taskId", "createdAt"])
    .index("by_parent", ["parentRunId"])
    .index("by_status", ["status"]),
  taskVersions: defineTable({
    taskId: v.id("tasks"),
    version: v.number(),
    diff: v.string(),
    summary: v.string(),
    createdAt: v.number(),
    files: v.array(v.object({
      path: v.string(),
      changes: v.string(),
    })),
  }).index("by_task", ["taskId", "version"]),
  repos: defineTable({
    fullName: v.string(),
    org: v.string(),
    name: v.string(),
  }).index("by_org", ["org"]),
  branches: defineTable({
    repo: v.string(),
    name: v.string(),
  }).index("by_repo", ["repo"]),
  taskRunLogChunks: defineTable({
    taskRunId: v.id("taskRuns"),
    content: v.string(), // Log content chunk
  })
    .index("by_taskRun", ["taskRunId"]),
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
    createdAt: v.number(),
    updatedAt: v.number(),
  }),
});
