import { v } from "convex/values";
import { getTeamId } from "../_shared/team";
import { internalMutation } from "./_generated/server";
import { authMutation, authQuery } from "./users/utils";

export const getReposByOrg = authQuery({
  args: { teamIdOrSlug: v.string() },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await getTeamId(ctx, args.teamIdOrSlug);
    const repos = await ctx.db
      .query("repos")
      .withIndex("by_team_user", (q) =>
        q.eq("teamId", teamId).eq("userId", userId)
      )
      .collect();

    // Group by organization
    const reposByOrg = repos.reduce(
      (acc, repo) => {
        if (!acc[repo.org]) {
          acc[repo.org] = [];
        }
        acc[repo.org].push(repo);
        return acc;
      },
      {} as Record<string, typeof repos>
    );

    return reposByOrg;
  },
});

export const getBranches = authQuery({
  args: { teamIdOrSlug: v.string(), repo: v.string() },
  handler: async (ctx, { teamIdOrSlug, repo }) => {
    const userId = ctx.identity.subject;
    const teamId = await getTeamId(ctx, teamIdOrSlug);
    const branches = await ctx.db
      .query("branches")
      .withIndex("by_team_user", (q) =>
        q.eq("teamId", teamId).eq("userId", userId)
      )
      .filter((q) => q.eq(q.field("repo"), repo))
      .collect();
    return branches.map((b) => b.name);
  },
});

// Queries
export const getAllRepos = authQuery({
  args: { teamIdOrSlug: v.string() },
  handler: async (ctx, { teamIdOrSlug }) => {
    const userId = ctx.identity.subject;
    const teamId = await getTeamId(ctx, teamIdOrSlug);
    return await ctx.db
      .query("repos")
      .withIndex("by_team_user", (q) =>
        q.eq("teamId", teamId).eq("userId", userId)
      )
      .collect();
  },
});

export const getBranchesByRepo = authQuery({
  args: { teamIdOrSlug: v.string(), repo: v.string() },
  handler: async (ctx, { teamIdOrSlug, repo }) => {
    const userId = ctx.identity.subject;
    const teamId = await getTeamId(ctx, teamIdOrSlug);
    return await ctx.db
      .query("branches")
      .withIndex("by_team_user", (q) =>
        q.eq("teamId", teamId).eq("userId", userId)
      )
      .filter((q) => q.eq(q.field("repo"), repo))
      .collect();
  },
});

// Internal mutations
export const insertRepo = internalMutation({
  args: {
    fullName: v.string(),
    org: v.string(),
    name: v.string(),
    gitRemote: v.string(),
    provider: v.optional(v.string()),
    userId: v.string(),
    teamIdOrSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const teamId = await getTeamId(ctx, args.teamIdOrSlug);
    const { ...rest } = args;
    return await ctx.db.insert("repos", { ...rest, teamId });
  },
});

export const upsertRepo = authMutation({
  args: {
    teamIdOrSlug: v.string(),
    fullName: v.string(),
    org: v.string(),
    name: v.string(),
    gitRemote: v.string(),
    provider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await getTeamId(ctx, args.teamIdOrSlug);
    // Check if repo already exists
    const existing = await ctx.db
      .query("repos")
      .withIndex("by_team_user", (q) =>
        q.eq("teamId", teamId).eq("userId", userId)
      )
      .filter((q) => q.eq(q.field("gitRemote"), args.gitRemote))
      .first();

    if (existing) {
      // Update existing repo
      return await ctx.db.patch(existing._id, {
        fullName: args.fullName,
        org: args.org,
        name: args.name,
        gitRemote: args.gitRemote,
        provider: args.provider,
      });
    } else {
      // Insert new repo
      return await ctx.db.insert("repos", {
        fullName: args.fullName,
        org: args.org,
        name: args.name,
        gitRemote: args.gitRemote,
        provider: args.provider || "github",
        userId,
        teamId,
      });
    }
  },
});

export const deleteRepo = internalMutation({
  args: { id: v.id("repos") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

export const insertBranch = internalMutation({
  args: {
    repo: v.string(),
    name: v.string(),
    userId: v.string(),
    teamIdOrSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const teamId = await getTeamId(ctx, args.teamIdOrSlug);
    const { ...rest } = args;
    return await ctx.db.insert("branches", { ...rest, teamId });
  },
});

export const deleteBranch = internalMutation({
  args: { id: v.id("branches") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

// Bulk mutations
export const bulkInsertRepos = authMutation({
  args: {
    teamIdOrSlug: v.string(),
    repos: v.array(
      v.object({
        fullName: v.string(),
        org: v.string(),
        name: v.string(),
        gitRemote: v.string(),
        provider: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { teamIdOrSlug, repos }) => {
    const userId = ctx.identity.subject;
    const teamId = await getTeamId(ctx, teamIdOrSlug);
    // Get existing repos to check for duplicates
    const existingRepos = await ctx.db
      .query("repos")
      .withIndex("by_team_user", (q) =>
        q.eq("teamId", teamId).eq("userId", userId)
      )
      .collect();
    const existingRepoNames = new Set(existingRepos.map((r) => r.fullName));

    // Only insert repos that don't already exist
    const newRepos = repos.filter(
      (repo) => !existingRepoNames.has(repo.fullName)
    );

    const insertedIds = await Promise.all(
      newRepos.map((repo) =>
        ctx.db.insert("repos", {
          ...repo,
          provider: repo.provider || "github",
          userId,
          teamId,
        })
      )
    );
    return insertedIds;
  },
});

export const bulkInsertBranches = authMutation({
  args: {
    teamIdOrSlug: v.string(),
    repo: v.string(),
    branches: v.array(v.string()),
  },
  handler: async (ctx, { teamIdOrSlug, repo, branches }) => {
    const userId = ctx.identity.subject;
    const teamId = await getTeamId(ctx, teamIdOrSlug);
    // Get existing branches for this repo
    const existingBranches = await ctx.db
      .query("branches")
      .withIndex("by_team_user", (q) =>
        q.eq("teamId", teamId).eq("userId", userId)
      )
      .filter((q) => q.eq(q.field("repo"), repo))
      .collect();
    const existingBranchNames = new Set(existingBranches.map((b) => b.name));

    // Only insert branches that don't already exist
    const newBranches = branches.filter(
      (name) => !existingBranchNames.has(name)
    );

    const insertedIds = await Promise.all(
      newBranches.map((name) =>
        ctx.db.insert("branches", { repo, name, userId, teamId })
      )
    );
    return insertedIds;
  },
});

// Full replacement mutations (use with caution)
export const replaceAllRepos = authMutation({
  args: {
    teamIdOrSlug: v.string(),
    repos: v.array(
      v.object({
        fullName: v.string(),
        org: v.string(),
        name: v.string(),
        gitRemote: v.string(),
        provider: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { teamIdOrSlug, repos }) => {
    const userId = ctx.identity.subject;
    const teamId = await getTeamId(ctx, teamIdOrSlug);
    // Delete all existing repos
    const existingRepos = await ctx.db
      .query("repos")
      .withIndex("by_team_user", (q) =>
        q.eq("teamId", teamId).eq("userId", userId)
      )
      .collect();
    await Promise.all(existingRepos.map((repo) => ctx.db.delete(repo._id)));

    // Insert all new repos
    const insertedIds = await Promise.all(
      repos.map((repo) => ctx.db.insert("repos", { ...repo, userId, teamId }))
    );
    return insertedIds;
  },
});
