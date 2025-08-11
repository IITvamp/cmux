import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const getLatestByTask = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const diff = await ctx.db
      .query("taskDiffs")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .order("desc")
      .first();
    
    return diff;
  },
});

export const getByRun = query({
  args: {
    runId: v.id("taskRuns"),
  },
  handler: async (ctx, args) => {
    const diff = await ctx.db
      .query("taskDiffs")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .first();
    
    return diff;
  },
});

export const create = mutation({
  args: {
    taskId: v.id("tasks"),
    runId: v.optional(v.id("taskRuns")),
    files: v.array(
      v.object({
        path: v.string(),
        oldContent: v.string(),
        newContent: v.string(),
        additions: v.number(),
        deletions: v.number(),
        hunks: v.array(
          v.object({
            oldStart: v.number(),
            oldLines: v.number(),
            newStart: v.number(),
            newLines: v.number(),
            content: v.string(),
          })
        ),
        fileStatus: v.union(
          v.literal("added"),
          v.literal("deleted"),
          v.literal("modified"),
          v.literal("renamed")
        ),
        oldPath: v.optional(v.string()),
      })
    ),
    stats: v.object({
      additions: v.number(),
      deletions: v.number(),
      filesChanged: v.number(),
    }),
    baseBranch: v.string(),
    headBranch: v.string(),
    baseCommit: v.optional(v.string()),
    headCommit: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    const diffId = await ctx.db.insert("taskDiffs", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
    
    return diffId;
  },
});

export const update = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    // This is a placeholder for the actual diff update logic
    // In a real implementation, this would:
    // 1. Get the current branch for the task
    // 2. Run git diff against the base branch
    // 3. Parse the diff output
    // 4. Update or create the taskDiff record
    
    const existingDiff = await ctx.db
      .query("taskDiffs")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .order("desc")
      .first();
    
    if (existingDiff) {
      await ctx.db.patch(existingDiff._id, {
        updatedAt: Date.now(),
      });
      return existingDiff._id;
    }
    
    // Create a mock diff for now
    const now = Date.now();
    const diffId = await ctx.db.insert("taskDiffs", {
      taskId: args.taskId,
      files: [],
      stats: {
        additions: 0,
        deletions: 0,
        filesChanged: 0,
      },
      baseBranch: "main",
      headBranch: "feature-branch",
      createdAt: now,
      updatedAt: now,
    });
    
    return diffId;
  },
});