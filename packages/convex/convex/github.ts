import { v } from "convex/values";
import { internalMutation, query, mutation } from "./_generated/server";

export const getReposByOrg = query({
  args: {},
  handler: async (ctx) => {
    const repos = await ctx.db.query("repos").collect();

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
  args: { repo: v.string() },
  handler: async (ctx, { repo }) => {
    const branches = await ctx.db
      .query("branches")
      .filter((q) => q.eq(q.field("repo"), repo))
      .collect();
    return branches.map((b) => b.name);
  },
});

// Queries
export const getAllRepos = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("repos").collect();
  },
});

export const getBranchesByRepo = query({
  args: { repo: v.string() },
  handler: async (ctx, { repo }) => {
    return await ctx.db
      .query("branches")
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("repos", args);
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
export const bulkInsertRepos = mutation({
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
    // Delete existing repos to avoid duplicates
    const existingRepos = await ctx.db.query("repos").collect();
    await Promise.all(existingRepos.map((repo) => ctx.db.delete(repo._id)));
    
    // Insert new repos
    const insertedIds = await Promise.all(
      repos.map((repo) => ctx.db.insert("repos", repo))
    );
    return insertedIds;
  },
});

export const bulkInsertBranches = mutation({
  args: {
    repo: v.string(),
    branches: v.array(v.string()),
  },
  handler: async (ctx, { repo, branches }) => {
    // Delete existing branches for this repo
    const existingBranches = await ctx.db
      .query("branches")
      .filter((q) => q.eq(q.field("repo"), repo))
      .collect();
    await Promise.all(existingBranches.map((branch) => ctx.db.delete(branch._id)));
    
    // Insert new branches
    const insertedIds = await Promise.all(
      branches.map((name) => ctx.db.insert("branches", { repo, name }))
    );
    return insertedIds;
  },
});
