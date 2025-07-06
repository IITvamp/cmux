import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

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

// Internal queries
export const getAllRepos = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("repos").collect();
  },
});

export const getBranchesByRepo = internalQuery({
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
