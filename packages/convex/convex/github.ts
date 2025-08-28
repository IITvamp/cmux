import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { authMutation, authQuery } from "./auth";

export const getReposByOrg = authQuery({
  args: {},
  handler: async (ctx) => {
    const repos = await ctx.db
      .query("repos")
      .withIndex("by_team_and_user", (q) => q.eq("teamId", ctx.teamId).eq("userId", ctx.userId))
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
  args: { repo: v.string() },
  handler: async (ctx, { repo }) => {
    const branches = await ctx.db
      .query("branches")
      .filter((q) => q.and(
        q.eq(q.field("repo"), repo),
        q.eq(q.field("teamId"), ctx.teamId)
      ))
      .collect();
    return branches.map((b) => b.name);
  },
});

// Queries
export const getAllRepos = authQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("repos")
      .withIndex("by_team_and_user", (q) => q.eq("teamId", ctx.teamId).eq("userId", ctx.userId))
      .collect();
  },
});

export const getBranchesByRepo = authQuery({
  args: { repo: v.string() },
  handler: async (ctx, { repo }) => {
    return await ctx.db
      .query("branches")
      .filter((q) => q.and(
        q.eq(q.field("repo"), repo),
        q.eq(q.field("teamId"), ctx.teamId)
      ))
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("repos", args);
  },
});

export const upsertRepo = authMutation({
  args: {
    fullName: v.string(),
    org: v.string(),
    name: v.string(),
    gitRemote: v.string(),
    provider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if repo already exists for this team
    const existing = await ctx.db
      .query("repos")
      .filter((q) => q.and(
        q.eq(q.field("gitRemote"), args.gitRemote),
        q.eq(q.field("teamId"), ctx.teamId)
      ))
      .first();

    if (existing) {
      // Update existing repo
      return await ctx.db.patch(existing._id, args);
    } else {
      // Insert new repo
      return await ctx.db.insert("repos", {
        ...args,
        provider: args.provider || "github",
        userId: ctx.userId,
        teamId: ctx.teamId,
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
export const bulkInsertRepos = authMutation({
  args: {
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
  handler: async (ctx, { repos }) => {
    // Get existing repos to check for duplicates within the team
    const existingRepos = await ctx.db
      .query("repos")
      .withIndex("by_team_and_user", (q) => q.eq("teamId", ctx.teamId).eq("userId", ctx.userId))
      .collect();
    const existingRepoNames = new Set(existingRepos.map((r) => r.fullName));

    // Only insert repos that don't already exist
    const newRepos = repos.filter(
      (repo) => !existingRepoNames.has(repo.fullName)
    );

    const insertedIds = await Promise.all(
      newRepos.map((repo) => ctx.db.insert("repos", {
        ...repo,
        userId: ctx.userId,
        teamId: ctx.teamId,
      }))
    );
    return insertedIds;
  },
});

export const bulkInsertBranches = authMutation({
  args: {
    repo: v.string(),
    branches: v.array(v.string()),
  },
  handler: async (ctx, { repo, branches }) => {
    // Get existing branches for this repo within the team
    const existingBranches = await ctx.db
      .query("branches")
      .filter((q) => q.and(
        q.eq(q.field("repo"), repo),
        q.eq(q.field("teamId"), ctx.teamId)
      ))
      .collect();
    const existingBranchNames = new Set(existingBranches.map((b) => b.name));

    // Only insert branches that don't already exist
    const newBranches = branches.filter(
      (name) => !existingBranchNames.has(name)
    );

    const insertedIds = await Promise.all(
      newBranches.map((name) => ctx.db.insert("branches", {
        repo,
        name,
        userId: ctx.userId,
        teamId: ctx.teamId,
      }))
    );
    return insertedIds;
  },
});

// Full replacement mutations (use with caution)
export const replaceAllRepos = authMutation({
  args: {
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
  handler: async (ctx, { repos }) => {
    // Delete all existing repos for this team
    const existingRepos = await ctx.db
      .query("repos")
      .withIndex("by_team_and_user", (q) => q.eq("teamId", ctx.teamId).eq("userId", ctx.userId))
      .collect();
    await Promise.all(existingRepos.map((repo) => ctx.db.delete(repo._id)));

    // Insert all new repos
    const insertedIds = await Promise.all(
      repos.map((repo) => ctx.db.insert("repos", {
        ...repo,
        userId: ctx.userId,
        teamId: ctx.teamId,
      }))
    );
    return insertedIds;
  },
});
