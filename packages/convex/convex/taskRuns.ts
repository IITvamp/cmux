import { v } from "convex/values";
import { type Doc } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

// Create a new task run
export const create = mutation({
  args: {
    taskId: v.id("tasks"),
    parentRunId: v.optional(v.id("taskRuns")),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const taskRunId = await ctx.db.insert("taskRuns", {
      taskId: args.taskId,
      parentRunId: args.parentRunId,
      prompt: args.prompt,
      status: "pending",
      log: "",
      createdAt: now,
      updatedAt: now,
    });
    return taskRunId;
  },
});

// Get all task runs for a task, organized in tree structure
export const getByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const runs = await ctx.db
      .query("taskRuns")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();

    // Build tree structure
    type TaskRunWithChildren = Doc<"taskRuns"> & {
      children: TaskRunWithChildren[];
    };
    const runMap = new Map<string, TaskRunWithChildren>();
    const rootRuns: TaskRunWithChildren[] = [];

    // First pass: create map with children arrays
    runs.forEach((run) => {
      runMap.set(run._id, { ...run, children: [] });
    });

    // Second pass: build tree
    runs.forEach((run) => {
      const runWithChildren = runMap.get(run._id)!;
      if (run.parentRunId) {
        const parent = runMap.get(run.parentRunId);
        if (parent) {
          parent.children.push(runWithChildren);
        }
      } else {
        rootRuns.push(runWithChildren);
      }
    });

    // Sort by creation date
    const sortRuns = (runs: TaskRunWithChildren[]) => {
      runs.sort((a, b) => a.createdAt - b.createdAt);
      runs.forEach((run) => sortRuns(run.children));
    };
    sortRuns(rootRuns);

    return rootRuns;
  },
});

// Update task run status
export const updateStatus = internalMutation({
  args: {
    id: v.id("taskRuns"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    exitCode: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const updates: {
      status: typeof args.status;
      updatedAt: number;
      completedAt?: number;
      exitCode?: number;
    } = {
      status: args.status,
      updatedAt: now,
    };

    if (args.status === "completed" || args.status === "failed") {
      updates.completedAt = now;
      if (args.exitCode !== undefined) {
        updates.exitCode = args.exitCode;
      }
    }

    await ctx.db.patch(args.id, updates);
  },
});

// Append to task run log
export const appendLog = internalMutation({
  args: {
    id: v.id("taskRuns"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.id);
    if (!run) {
      throw new Error("Task run not found");
    }

    console.log(
      `[appendLog] Adding ${args.content.length} chars to task run ${args.id}`
    );

    await ctx.db.patch(args.id, {
      log: run.log + args.content,
      updatedAt: Date.now(),
    });
  },
});

// Update task run summary
export const updateSummary = mutation({
  args: {
    id: v.id("taskRuns"),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      summary: args.summary,
      updatedAt: Date.now(),
    });
  },
});

// Get a single task run
export const get = query({
  args: { id: v.id("taskRuns") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Subscribe to task run updates
export const subscribe = query({
  args: { id: v.id("taskRuns") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Internal mutation to update exit code
export const updateExitCode = internalMutation({
  args: {
    id: v.id("taskRuns"),
    exitCode: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      exitCode: args.exitCode,
      updatedAt: Date.now(),
    });
  },
});

// Update worktree path for a task run
export const updateWorktreePath = mutation({
  args: {
    id: v.id("taskRuns"),
    worktreePath: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      worktreePath: args.worktreePath,
      updatedAt: Date.now(),
    });
  },
});

// Internal query to get a task run by ID
export const getById = internalQuery({
  args: { id: v.id("taskRuns") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Public mutation to update task run status (for tRPC usage)
export const updateStatusPublic = mutation({
  args: {
    id: v.id("taskRuns"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    exitCode: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const updates: {
      status: typeof args.status;
      updatedAt: number;
      completedAt?: number;
      exitCode?: number;
    } = {
      status: args.status,
      updatedAt: now,
    };

    if (args.status === "completed" || args.status === "failed") {
      updates.completedAt = now;
      if (args.exitCode !== undefined) {
        updates.exitCode = args.exitCode;
      }
    }

    await ctx.db.patch(args.id, updates);
  },
});

// Public mutation to append to task run log (for tRPC usage)
export const appendLogPublic = mutation({
  args: {
    id: v.id("taskRuns"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.id);
    if (!run) {
      throw new Error("Task run not found");
    }

    console.log(
      `[appendLog] Adding ${args.content.length} chars to task run ${args.id}`
    );

    await ctx.db.patch(args.id, {
      log: run.log + args.content,
      updatedAt: Date.now(),
    });
  },
});
