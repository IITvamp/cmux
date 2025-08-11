import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const getByTask = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const pr = await ctx.db
      .query("pullRequests")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .first();
    
    return pr;
  },
});

export const getByRun = query({
  args: {
    runId: v.id("taskRuns"),
  },
  handler: async (ctx, args) => {
    const pr = await ctx.db
      .query("pullRequests")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .first();
    
    return pr;
  },
});

export const createOrUpdate = mutation({
  args: {
    taskId: v.id("tasks"),
    isDraft: v.optional(v.boolean()),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Task not found");
    }
    
    const existingPR = await ctx.db
      .query("pullRequests")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .first();
    
    const now = Date.now();
    
    if (existingPR) {
      // Update existing PR
      const updates: any = {
        updatedAt: now,
      };
      
      if (args.title !== undefined) updates.title = args.title;
      if (args.body !== undefined) updates.body = args.body;
      if (args.isDraft !== undefined) {
        updates.status = args.isDraft ? "draft" : "open";
      }
      
      await ctx.db.patch(existingPR._id, updates);
      return existingPR._id;
    } else {
      // Create new PR
      const prId = await ctx.db.insert("pullRequests", {
        taskId: args.taskId,
        status: args.isDraft ? "draft" : "open",
        title: args.title || task.text || "Update from task",
        body: args.body || `Changes from task: ${task.text}`,
        baseBranch: "main",
        headBranch: task.branch || "feature-branch",
        repoFullName: task.projectFullName || "unknown/repo",
        createdAt: now,
        updatedAt: now,
      });
      
      return prId;
    }
  },
});

export const merge = mutation({
  args: {
    pullRequestId: v.id("pullRequests"),
    mergeMethod: v.union(v.literal("squash"), v.literal("merge"), v.literal("rebase")),
  },
  handler: async (ctx, args) => {
    const pr = await ctx.db.get(args.pullRequestId);
    if (!pr) {
      throw new Error("Pull request not found");
    }
    
    if (pr.status === "merged" || pr.status === "closed") {
      throw new Error("Pull request is already closed or merged");
    }
    
    // In a real implementation, this would:
    // 1. Call the GitHub/GitLab API to merge the PR
    // 2. Update the PR status based on the response
    
    await ctx.db.patch(args.pullRequestId, {
      status: "merged",
      mergeMethod: args.mergeMethod,
      updatedAt: Date.now(),
    });
    
    return args.pullRequestId;
  },
});

export const updateStatus = mutation({
  args: {
    pullRequestId: v.id("pullRequests"),
    status: v.union(
      v.literal("draft"),
      v.literal("open"),
      v.literal("closed"),
      v.literal("merged")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.pullRequestId, {
      status: args.status,
      updatedAt: Date.now(),
    });
    
    return args.pullRequestId;
  },
});