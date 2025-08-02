import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    taskId: v.id("tasks"),
    reviewModel: v.string(),
    reviewPrompt: v.string(),
  },
  handler: async (ctx, args) => {
    const codeReviewId = await ctx.db.insert("codeReviews", {
      taskId: args.taskId,
      taskRuns: [],
      reviewPrompt: args.reviewPrompt,
      reviewModel: args.reviewModel,
      createdAt: Date.now(),
      status: "pending",
    });
    
    return codeReviewId;
  },
});

export const update = mutation({
  args: {
    codeReviewId: v.id("codeReviews"),
    taskRuns: v.optional(
      v.array(
        v.object({
          taskRunId: v.id("taskRuns"),
          agentName: v.string(),
          diff: v.string(),
          evaluation: v.object({
            score: v.number(),
            codeQuality: v.number(),
            adherenceToRequirements: v.number(),
            testCoverage: v.number(),
            performance: v.number(),
            security: v.number(),
            reasoning: v.string(),
          }),
        })
      )
    ),
    winnerId: v.optional(v.id("taskRuns")),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("reviewing"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),
  },
  handler: async (ctx, args) => {
    const updates: any = {};
    
    if (args.taskRuns !== undefined) {
      updates.taskRuns = args.taskRuns;
    }
    if (args.winnerId !== undefined) {
      updates.winnerId = args.winnerId;
    }
    if (args.status !== undefined) {
      updates.status = args.status;
      if (args.status === "completed") {
        updates.completedAt = Date.now();
      }
    }
    
    await ctx.db.patch(args.codeReviewId, updates);
  },
});

export const getByTaskId = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const codeReview = await ctx.db
      .query("codeReviews")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .order("desc")
      .first();
    
    return codeReview;
  },
});

export const getById = query({
  args: { codeReviewId: v.id("codeReviews") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.codeReviewId);
  },
});