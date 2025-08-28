import { v } from "convex/values";
import { authMutation as mutation, authQuery as query } from "../_shared/auth";
import { ensureAuth } from "../_shared/ensureAuth";

export const appendChunk = mutation({
  args: {
    taskRunId: v.id("taskRuns"),
    content: v.string(),
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await ensureAuth(ctx);
    await ctx.db.insert("taskRunLogChunks", {
      taskRunId: args.taskRunId,
      content: args.content,
      userId,
      teamId: args.teamId,
    });
  },
});

export const appendChunkPublic = mutation({
  args: {
    taskRunId: v.id("taskRuns"),
    content: v.string(),
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await ensureAuth(ctx);
    await ctx.db.insert("taskRunLogChunks", {
      taskRunId: args.taskRunId,
      content: args.content,
      userId,
      teamId: args.teamId,
    });
  },
});

export const getChunks = query({
  args: {
    taskRunId: v.id("taskRuns"),
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    const chunks = await ctx.db
      .query("taskRunLogChunks")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("taskRunId"), args.taskRunId))
      .collect();
    
    return chunks;
  },
});

