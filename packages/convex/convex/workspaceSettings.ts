import { v } from "convex/values";
import { authMutation as mutation, authQuery as query } from "../_shared/auth";
import { ensureAuth } from "../_shared/ensureAuth";

export const get = query({
  args: { teamId: v.string() },
  handler: async (ctx, { teamId }) => {
    await ensureAuth(ctx);
    const settings = await ctx.db
      .query("workspaceSettings")
      .withIndex("by_team_user", (q) => q.eq("teamId", teamId))
      .first();
    return settings;
  },
});

export const update = mutation({
  args: {
    teamId: v.string(),
    worktreePath: v.optional(v.string()),
    autoPrEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId } = await ensureAuth(ctx);
    const existing = await ctx.db
      .query("workspaceSettings")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId))
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
        createdAt: now,
        updatedAt: now,
        userId,
        teamId: args.teamId,
      });
    }
  },
});
