import { v } from "convex/values";
import { authMutation, authQuery } from "./auth";

export const getAll = authQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("apiKeys")
      .withIndex("by_team_and_user", (q) => q.eq("teamId", ctx.teamId).eq("userId", ctx.userId))
      .collect();
  },
});

export const getByEnvVar = authQuery({
  args: {
    envVar: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("apiKeys")
      .withIndex("by_envVar", (q) => q.eq("envVar", args.envVar))
      .filter((q) => q.eq(q.field("teamId"), ctx.teamId))
      .first();
  },
});

export const upsert = authMutation({
  args: {
    envVar: v.string(),
    value: v.string(),
    displayName: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("apiKeys")
      .withIndex("by_envVar", (q) => q.eq("envVar", args.envVar))
      .filter((q) => q.eq(q.field("teamId"), ctx.teamId))
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
        userId: ctx.userId,
        teamId: ctx.teamId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

export const remove = authMutation({
  args: {
    envVar: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("apiKeys")
      .withIndex("by_envVar", (q) => q.eq("envVar", args.envVar))
      .filter((q) => q.eq(q.field("teamId"), ctx.teamId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const getAllForAgents = authQuery({
  args: {},
  handler: async (ctx) => {
    const apiKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_team_and_user", (q) => q.eq("teamId", ctx.teamId).eq("userId", ctx.userId))
      .collect();
    const keyMap: Record<string, string> = {};

    for (const key of apiKeys) {
      keyMap[key.envVar] = key.value;
    }

    return keyMap;
  },
});
