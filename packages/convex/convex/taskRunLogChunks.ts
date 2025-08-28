import { v } from "convex/values";
import { authMutation, authQuery } from "./auth/functions.js";

export const appendChunk = authMutation({
  args: {
    taskRunId: v.id("taskRuns"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("taskRunLogChunks", {
      userId: ctx.userId,
      teamId: ctx.teamId,
      taskRunId: args.taskRunId,
      content: args.content,
    });
  },
});

export const appendChunkPublic = authMutation({
  args: {
    taskRunId: v.id("taskRuns"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("taskRunLogChunks", {
      userId: ctx.userId,
      teamId: ctx.teamId,
      taskRunId: args.taskRunId,
      content: args.content,
    });
  },
});

export const getChunks = authQuery({
  args: {
    taskRunId: v.id("taskRuns"),
  },
  handler: async (ctx, args) => {
    const chunks = await ctx.db
      .query("taskRunLogChunks")
      .withIndex("by_team_user", (q) =>
        q.eq("teamId", ctx.teamId).eq("userId", ctx.userId)
      )
      .filter((q) => q.eq(q.field("taskRunId"), args.taskRunId))
      .collect();
    
    return chunks;
  },
});

