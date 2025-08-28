import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { authMutation as mutation, authQuery as query } from "../_shared/auth";
import { ensureAuth } from "../_shared/ensureAuth";

export const getReposByOrg = query({
  args: { teamId: v.string() },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    const repos = await ctx.db
      .query("repos")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId))
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

export const getBranches = query({
  args: { repo: v.string(), teamId: v.string() },
  handler: async (ctx, { repo, teamId }) => {
    await ensureAuth(ctx);
    const branches = await ctx.db
      .query("branches")
      .withIndex("by_team_user", (q) => q.eq("teamId", teamId))
      .filter((q) => q.eq(q.field("repo"), repo))
      .collect();
    return branches.map((b) => b.name);
  },
});

// Queries
export const getAllRepos = query({
  args: { teamId: v.string() },
  handler: async (ctx, { teamId }) => {
    await ensureAuth(ctx);
    return await ctx.db
      .query("repos")
      .withIndex("by_team_user", (q) => q.eq("teamId", teamId))
      .collect();
  },
});

export const getBranchesByRepo = query({
  args: { repo: v.string(), teamId: v.string() },
  handler: async (ctx, { repo, teamId }) => {
    await ensureAuth(ctx);
    return await ctx.db
      .query("branches")
      .withIndex("by_team_user", (q) => q.eq("teamId", teamId))
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
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("repos", args);
  },
});

export const upsertRepo = mutation({
  args: {
    fullName: v.string(),
    org: v.string(),
    name: v.string(),
    gitRemote: v.string(),
    provider: v.optional(v.string()),
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await ensureAuth(ctx);
    // Check if repo already exists (scoped by team)
    const existing = await ctx.db
      .query("repos")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId))
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
        teamId: args.teamId,
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
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("branches", args);
  },
});

export const deleteBranch = internalMutation({
  args: { id: v.id("branches") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

// Bulk mutations
export const bulkInsertRepos = mutation({
  args: {
    teamId: v.string(),
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
  handler: async (ctx, { repos, teamId }) => {
    const { userId } = await ensureAuth(ctx);
    // Get existing repos to check for duplicates (scoped by team)
    const existingRepos = await ctx.db
      .query("repos")
      .withIndex("by_team_user", (q) => q.eq("teamId", teamId))
      .collect();
    const existingRepoNames = new Set(existingRepos.map((r) => r.fullName));

    // Only insert repos that don't already exist
    const newRepos = repos.filter((repo) => !existingRepoNames.has(repo.fullName));

    const insertedIds = await Promise.all(
      newRepos.map((repo) =>
        ctx.db.insert("repos", { ...repo, provider: repo.provider || "github", userId, teamId })
      )
    );
    return insertedIds;
  },
});

export const bulkInsertBranches = mutation({
  args: {
    repo: v.string(),
    branches: v.array(v.string()),
    teamId: v.string(),
  },
  handler: async (ctx, { repo, branches, teamId }) => {
    const { userId } = await ensureAuth(ctx);
    // Get existing branches for this repo
    const existingBranches = await ctx.db
      .query("branches")
      .withIndex("by_team_user", (q) => q.eq("teamId", teamId))
      .filter((q) => q.eq(q.field("repo"), repo))
      .collect();
    const existingBranchNames = new Set(existingBranches.map((b) => b.name));

    // Only insert branches that don't already exist
    const newBranches = branches.filter((name) => !existingBranchNames.has(name));

    const insertedIds = await Promise.all(
      newBranches.map((name) => ctx.db.insert("branches", { repo, name, userId, teamId }))
    );
    return insertedIds;
  },
});

// Full replacement mutations (use with caution)
export const replaceAllRepos = mutation({
  args: {
    teamId: v.string(),
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
  handler: async (ctx, { repos, teamId }) => {
    const { userId } = await ensureAuth(ctx);
    // Delete all existing repos for team
    const existingRepos = await ctx.db
      .query("repos")
      .withIndex("by_team_user", (q) => q.eq("teamId", teamId))
      .collect();
    await Promise.all(existingRepos.map((repo) => ctx.db.delete(repo._id)));

    // Insert all new repos
    const insertedIds = await Promise.all(
      repos.map((repo) => ctx.db.insert("repos", { ...repo, provider: repo.provider || "github", userId, teamId }))
    );
    return insertedIds;
  },
});
