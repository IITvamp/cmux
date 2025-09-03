import { v } from "convex/values";
import { resolveTeamIdLoose } from "../_shared/team";
import { authMutation, authQuery } from "./users/utils";

export const list = authQuery({
  args: { teamSlugOrId: v.string() },
  handler: async (ctx, args) => {
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);
    return await ctx.db
      .query("environments")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .order("desc")
      .collect();
  },
});

export const get = authQuery({
  args: {
    teamSlugOrId: v.string(),
    id: v.id("environments"),
  },
  handler: async (ctx, args) => {
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);
    const environment = await ctx.db.get(args.id);
    
    if (!environment || environment.teamId !== teamId) {
      return null;
    }
    
    return environment;
  },
});

export const create = authMutation({
  args: {
    teamSlugOrId: v.string(),
    name: v.string(),
    morphSnapshotId: v.string(),
    dataVaultKey: v.string(),
    selectedRepos: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
    maintenanceScript: v.optional(v.string()),
    devScript: v.optional(v.string()),
    exposedPorts: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);
    
    return await ctx.db.insert("environments", {
      name: args.name,
      teamId,
      userId,
      morphSnapshotId: args.morphSnapshotId,
      dataVaultKey: args.dataVaultKey,
      selectedRepos: args.selectedRepos,
      description: args.description,
      maintenanceScript: args.maintenanceScript,
      devScript: args.devScript,
      exposedPorts: args.exposedPorts,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const update = authMutation({
  args: {
    teamSlugOrId: v.string(),
    id: v.id("environments"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);
    const environment = await ctx.db.get(args.id);
    
    if (!environment || environment.teamId !== teamId) {
      throw new Error("Environment not found");
    }
    
    const updates: Record<string, any> = {
      updatedAt: Date.now(),
    };
    
    if (args.name !== undefined) {
      updates.name = args.name;
    }
    
    if (args.description !== undefined) {
      updates.description = args.description;
    }
    
    await ctx.db.patch(args.id, updates);
    
    return args.id;
  },
});

export const remove = authMutation({
  args: {
    teamSlugOrId: v.string(),
    id: v.id("environments"),
  },
  handler: async (ctx, args) => {
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);
    const environment = await ctx.db.get(args.id);
    
    if (!environment || environment.teamId !== teamId) {
      throw new Error("Environment not found");
    }
    
    await ctx.db.delete(args.id);
  },
});

export const getByDataVaultKey = authQuery({
  args: {
    dataVaultKey: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("environments")
      .withIndex("by_dataVaultKey", (q) => q.eq("dataVaultKey", args.dataVaultKey))
      .first();
  },
});
