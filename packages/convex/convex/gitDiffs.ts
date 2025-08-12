import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getByTaskRun = query({
  args: { taskRunId: v.id("taskRuns") },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("gitDiffs")
      .withIndex("by_taskRun", (q) => q.eq("taskRunId", args.taskRunId))
      .collect();
    
    console.log(`[gitDiffs.getByTaskRun] Found ${results.length} diffs for taskRun ${args.taskRunId}`);
    return results;
  },
});

export const upsertDiff = mutation({
  args: {
    taskRunId: v.id("taskRuns"),
    filePath: v.string(),
    oldPath: v.optional(v.string()),
    status: v.union(
      v.literal("added"),
      v.literal("modified"),
      v.literal("deleted"),
      v.literal("renamed")
    ),
    additions: v.number(),
    deletions: v.number(),
    patch: v.optional(v.string()),
    oldContent: v.optional(v.string()),
    newContent: v.optional(v.string()),
    contentOmitted: v.optional(v.boolean()),
    oldSize: v.optional(v.number()),
    newSize: v.optional(v.number()),
    patchSize: v.optional(v.number()),
    isBinary: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Check if diff already exists
    const existing = await ctx.db
      .query("gitDiffs")
      .withIndex("by_taskRun", (q) => 
        q.eq("taskRunId", args.taskRunId).eq("filePath", args.filePath)
      )
      .first();

    if (existing) {
      // Update existing diff
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Create new diff
      return await ctx.db.insert("gitDiffs", {
        ...args,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const clearByTaskRun = mutation({
  args: { taskRunId: v.id("taskRuns") },
  handler: async (ctx, args) => {
    const diffs = await ctx.db
      .query("gitDiffs")
      .withIndex("by_taskRun", (q) => q.eq("taskRunId", args.taskRunId))
      .collect();
    
    for (const diff of diffs) {
      await ctx.db.delete(diff._id);
    }
    
    return diffs.length;
  },
});

export const updateDiffsTimestamp = mutation({
  args: { taskRunId: v.id("taskRuns") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskRunId, {
      diffsLastUpdated: Date.now(),
    });
  },
});
