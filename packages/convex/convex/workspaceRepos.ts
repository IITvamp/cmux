import { v } from "convex/values";
import { resolveTeamIdLoose } from "../_shared/team";
import type { Id } from "./_generated/dataModel";
import { authMutation, authQuery } from "./users/utils";

export const list = authQuery({
  args: { teamSlugOrId: v.string() },
  handler: async (ctx, args) => {
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const workspace = await ctx.db
      .query("dashboardWorkspaces")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .first();

    if (!workspace) {
      return [];
    }

    const repos = await ctx.db
      .query("workspaceRepos")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
      .collect();

    return repos;
  },
});

export const get = authQuery({
  args: { teamSlugOrId: v.string(), repoFullName: v.string() },
  handler: async (ctx, args) => {
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const workspace = await ctx.db
      .query("dashboardWorkspaces")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .first();

    if (!workspace) {
      return null;
    }

    const repo = await ctx.db
      .query("workspaceRepos")
      .withIndex("by_workspace_repo", (q) =>
        q.eq("workspaceId", workspace._id).eq("repoFullName", args.repoFullName)
      )
      .first();

    return repo;
  },
});

export const upsert = authMutation({
  args: {
    teamSlugOrId: v.string(),
    repoFullName: v.string(),
    repoUrl: v.string(),
    localPath: v.string(),
    defaultBranch: v.optional(v.string()),
    currentBranch: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const workspace = await ctx.db
      .query("dashboardWorkspaces")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .first();

    if (!workspace) {
      throw new Error("Dashboard workspace not found");
    }

    const existing = await ctx.db
      .query("workspaceRepos")
      .withIndex("by_workspace_repo", (q) =>
        q.eq("workspaceId", workspace._id).eq("repoFullName", args.repoFullName)
      )
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        repoUrl: args.repoUrl,
        localPath: args.localPath,
        defaultBranch: args.defaultBranch,
        currentBranch: args.currentBranch,
        updatedAt: now,
        lastAccessedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("workspaceRepos", {
      workspaceId: workspace._id,
      teamId,
      repoFullName: args.repoFullName,
      repoUrl: args.repoUrl,
      localPath: args.localPath,
      defaultBranch: args.defaultBranch,
      currentBranch: args.currentBranch,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
    });
  },
});

export const updateStatus = authMutation({
  args: {
    teamSlugOrId: v.string(),
    repoFullName: v.string(),
    isDirty: v.optional(v.boolean()),
    currentBranch: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const workspace = await ctx.db
      .query("dashboardWorkspaces")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .first();

    if (!workspace) {
      throw new Error("Dashboard workspace not found");
    }

    const repo = await ctx.db
      .query("workspaceRepos")
      .withIndex("by_workspace_repo", (q) =>
        q.eq("workspaceId", workspace._id).eq("repoFullName", args.repoFullName)
      )
      .first();

    if (!repo) {
      throw new Error("Repository not found in workspace");
    }

    await ctx.db.patch(repo._id, {
      isDirty: args.isDirty,
      currentBranch: args.currentBranch,
      updatedAt: Date.now(),
    });
  },
});

export const updateLastFetched = authMutation({
  args: { teamSlugOrId: v.string(), repoFullName: v.string() },
  handler: async (ctx, args) => {
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const workspace = await ctx.db
      .query("dashboardWorkspaces")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .first();

    if (!workspace) {
      throw new Error("Dashboard workspace not found");
    }

    const repo = await ctx.db
      .query("workspaceRepos")
      .withIndex("by_workspace_repo", (q) =>
        q.eq("workspaceId", workspace._id).eq("repoFullName", args.repoFullName)
      )
      .first();

    if (!repo) {
      throw new Error("Repository not found in workspace");
    }

    await ctx.db.patch(repo._id, {
      lastFetchedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const remove = authMutation({
  args: { teamSlugOrId: v.string(), repoFullName: v.string() },
  handler: async (ctx, args) => {
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const workspace = await ctx.db
      .query("dashboardWorkspaces")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .first();

    if (!workspace) {
      return;
    }

    const repo = await ctx.db
      .query("workspaceRepos")
      .withIndex("by_workspace_repo", (q) =>
        q.eq("workspaceId", workspace._id).eq("repoFullName", args.repoFullName)
      )
      .first();

    if (repo) {
      await ctx.db.delete(repo._id);
    }
  },
});
