import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tasks").collect();
  },
});

export const create = mutation({
  args: {
    text: v.string(),
    description: v.optional(v.string()),
    projectFullName: v.optional(v.string()),
    branch: v.optional(v.string()),
    worktreePath: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const taskId = await ctx.db.insert("tasks", {
      text: args.text,
      description: args.description,
      projectFullName: args.projectFullName,
      branch: args.branch,
      worktreePath: args.worktreePath,
      isCompleted: false,
      createdAt: now,
      updatedAt: now,
    });

    return taskId;
  },
});

export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const toggle = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (task === null) {
      throw new Error("Task not found");
    }
    await ctx.db.patch(args.id, { isCompleted: !task.isCompleted });
  },
});

export const update = mutation({
  args: { id: v.id("tasks"), text: v.string() },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (task === null) {
      throw new Error("Task not found");
    }
    await ctx.db.patch(args.id, { text: args.text, updatedAt: Date.now() });
  },
});

export const getById = query({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getVersions = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("taskVersions")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();
  },
});

export const createVersion = mutation({
  args: {
    taskId: v.id("tasks"),
    diff: v.string(),
    summary: v.string(),
    files: v.array(
      v.object({
        path: v.string(),
        changes: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const existingVersions = await ctx.db
      .query("taskVersions")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();

    const version = existingVersions.length + 1;

    const versionId = await ctx.db.insert("taskVersions", {
      taskId: args.taskId,
      version,
      diff: args.diff,
      summary: args.summary,
      files: args.files,
      createdAt: Date.now(),
    });

    await ctx.db.patch(args.taskId, { updatedAt: Date.now() });

    return versionId;
  },
});
