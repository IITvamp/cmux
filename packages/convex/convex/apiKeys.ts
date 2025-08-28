import { v } from "convex/values";
import { authMutation as mutation, authQuery as query } from "../_shared/auth";
import { ensureAuth } from "../_shared/ensureAuth";

export const getAll = query({
  args: { teamId: v.string() },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    return await ctx.db
      .query("apiKeys")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId))
      .collect();
  },
});

export const getByEnvVar = query({
  args: {
    envVar: v.string(),
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    return await ctx.db
      .query("apiKeys")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("envVar"), args.envVar))
      .first();
  },
});

export const upsert = mutation({
  args: {
    envVar: v.string(),
    value: v.string(),
    displayName: v.string(),
    description: v.optional(v.string()),
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await ensureAuth(ctx);
    const existing = await ctx.db
      .query("apiKeys")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("envVar"), args.envVar))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        displayName: args.displayName,
        description: args.description,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("apiKeys", {
        envVar: args.envVar,
        value: args.value,
        displayName: args.displayName,
        description: args.description,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        userId,
        teamId: args.teamId,
      });
    }
  },
});

export const remove = mutation({
  args: {
    envVar: v.string(),
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    const existing = await ctx.db
      .query("apiKeys")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("envVar"), args.envVar))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const getAllForAgents = query({
  args: { teamId: v.string() },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    const apiKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId))
      .collect();
    const keyMap: Record<string, string> = {};

    for (const key of apiKeys) {
      keyMap[key.envVar] = key.value;
    }

    return keyMap;
  },
});
