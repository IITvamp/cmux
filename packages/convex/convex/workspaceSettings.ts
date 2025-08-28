import { v } from "convex/values";
import { authMutation, authQuery } from "./auth";

export const get = authQuery({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db
      .query("workspaceSettings")
      .withIndex("by_team_and_user", (q) => q.eq("teamId", ctx.teamId).eq("userId", ctx.userId))
      .first();
    return settings;
  },
});

export const update = authMutation({
  args: {
    worktreePath: v.optional(v.string()),
    autoPrEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("workspaceSettings")
      .withIndex("by_team_and_user", (q) => q.eq("teamId", ctx.teamId).eq("userId", ctx.userId))
      .first();
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        worktreePath: args.worktreePath,
        autoPrEnabled: args.autoPrEnabled,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("workspaceSettings", {
        worktreePath: args.worktreePath,
        autoPrEnabled: args.autoPrEnabled,
        userId: ctx.userId,
        teamId: ctx.teamId,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});
