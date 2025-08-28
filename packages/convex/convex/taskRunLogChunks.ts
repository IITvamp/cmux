import { v } from "convex/values";
import { authMutation, authQuery } from "./auth";

export const appendChunk = authMutation({
  args: {
    taskRunId: v.id("taskRuns"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // First verify the task run belongs to the user's team
    const taskRun = await ctx.db.get(args.taskRunId);
    if (!taskRun || taskRun.teamId !== ctx.teamId) {
      throw new Error("Task run not found or access denied");
    }

    await ctx.db.insert("taskRunLogChunks", {
      taskRunId: args.taskRunId,
      content: args.content,
      userId: ctx.userId,
      teamId: ctx.teamId,
    });
  },
});

export const appendChunkPublic = authMutation({
  args: {
    taskRunId: v.id("taskRuns"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // First verify the task run belongs to the user's team
    const taskRun = await ctx.db.get(args.taskRunId);
    if (!taskRun || taskRun.teamId !== ctx.teamId) {
      throw new Error("Task run not found or access denied");
    }

    await ctx.db.insert("taskRunLogChunks", {
      taskRunId: args.taskRunId,
      content: args.content,
      userId: ctx.userId,
      teamId: ctx.teamId,
    });
  },
});

export const getChunks = authQuery({
  args: {
    taskRunId: v.id("taskRuns"),
  },
  handler: async (ctx, args) => {
    // First verify the task run belongs to the user's team
    const taskRun = await ctx.db.get(args.taskRunId);
    if (!taskRun || taskRun.teamId !== ctx.teamId) {
      return [];
    }

    const chunks = await ctx.db
      .query("taskRunLogChunks")
      .withIndex("by_taskRun", (q) => q.eq("taskRunId", args.taskRunId))
      .filter((q) => q.eq(q.field("teamId"), ctx.teamId))
      .collect();
    
    return chunks;
  },
});

