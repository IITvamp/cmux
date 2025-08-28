import { v } from "convex/values";
import { authMutation, authQuery } from "./users/utils";
import { getTeamId } from "../_shared/team";

export const appendChunk = authMutation({
  args: {
    teamIdOrSlug: v.string(),
    taskRunId: v.id("taskRuns"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await getTeamId(ctx, args.teamIdOrSlug);
    await ctx.db.insert("taskRunLogChunks", {
      taskRunId: args.taskRunId,
      content: args.content,
      userId,
      teamId,
    });
  },
});

export const appendChunkPublic = authMutation({
  args: {
    teamIdOrSlug: v.string(),
    taskRunId: v.id("taskRuns"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await getTeamId(ctx, args.teamIdOrSlug);
    await ctx.db.insert("taskRunLogChunks", {
      taskRunId: args.taskRunId,
      content: args.content,
      userId,
      teamId,
    });
  },
});

export const getChunks = authQuery({
  args: {
    teamIdOrSlug: v.string(),
    taskRunId: v.id("taskRuns"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await getTeamId(ctx, args.teamIdOrSlug);
    const chunks = await ctx.db
      .query("taskRunLogChunks")
      .withIndex("by_team_user", (q) =>
        q.eq("teamId", teamId).eq("userId", userId)
      )
      .filter((q) => q.eq(q.field("taskRunId"), args.taskRunId))
      .collect();
    
    return chunks;
  },
});
