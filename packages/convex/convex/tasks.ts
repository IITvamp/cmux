import { v } from "convex/values";
import { ensureAuth } from "../_shared/ensureAuth";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { authMutation as mutation, authQuery as query } from "../_shared/auth";

export const get = query({
  args: {
    teamId: v.string(),
    projectFullName: v.optional(v.string()),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    let q = ctx.db
      .query("tasks")
      .withIndex("by_team_user", (qi) => qi.eq("teamId", args.teamId));

    // Default to active (non-archived) when not specified
    if (args.archived === true) {
      q = q.filter((qq) => qq.eq(qq.field("isArchived"), true));
    } else {
      q = q.filter((qq) => qq.neq(qq.field("isArchived"), true));
    }

    if (args.projectFullName) {
      q = q.filter((qq) => qq.eq(qq.field("projectFullName"), args.projectFullName));
    }

    return await q.order("desc").collect();
  },
});

export const create = mutation({
  args: {
    teamId: v.string(),
    text: v.string(),
    description: v.optional(v.string()),
    projectFullName: v.optional(v.string()),
    baseBranch: v.optional(v.string()),
    worktreePath: v.optional(v.string()),
    images: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          fileName: v.optional(v.string()),
          altText: v.string(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const { userId } = await ensureAuth(ctx);
    const now = Date.now();
    const taskId = await ctx.db.insert("tasks", {
      text: args.text,
      description: args.description,
      projectFullName: args.projectFullName,
      baseBranch: args.baseBranch,
      worktreePath: args.worktreePath,
      isCompleted: false,
      createdAt: now,
      updatedAt: now,
      images: args.images,
      userId,
      teamId: args.teamId,
    });

    return taskId;
  },
});

export const remove = mutation({
  args: { id: v.id("tasks"), teamId: v.string() },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    await ctx.db.delete(args.id);
  },
});

export const toggle = mutation({
  args: { id: v.id("tasks"), teamId: v.string() },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    const task = await ctx.db.get(args.id);
    if (task === null) {
      throw new Error("Task not found");
    }
    await ctx.db.patch(args.id, { isCompleted: !task.isCompleted });
  },
});

export const setCompleted = mutation({
  args: {
    id: v.id("tasks"),
    isCompleted: v.boolean(),
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    const task = await ctx.db.get(args.id);
    if (task === null) {
      throw new Error("Task not found");
    }
    await ctx.db.patch(args.id, {
      isCompleted: args.isCompleted,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: { id: v.id("tasks"), text: v.string(), teamId: v.string() },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    const task = await ctx.db.get(args.id);
    if (task === null) {
      throw new Error("Task not found");
    }
    await ctx.db.patch(args.id, { text: args.text, updatedAt: Date.now() });
  },
});

export const getById = query({
  args: { id: v.id("tasks"), teamId: v.string() },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    const task = await ctx.db.get(args.id);
    if (!task) return null;

    // If task has images, get their URLs
    if (task.images && task.images.length > 0) {
      const imagesWithUrls = await Promise.all(
        task.images.map(async (image) => {
          const url = await ctx.storage.getUrl(image.storageId);
          return {
            ...image,
            url,
          };
        })
      );
      return {
        ...task,
        images: imagesWithUrls,
      };
    }

    return task;
  },
});

export const getVersions = query({
  args: { taskId: v.id("tasks"), teamId: v.string() },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    return await ctx.db
      .query("taskVersions")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("taskId"), args.taskId))
      .collect();
  },
});

export const archive = mutation({
  args: { id: v.id("tasks"), teamId: v.string() },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    const task = await ctx.db.get(args.id);
    if (task === null) {
      throw new Error("Task not found");
    }
    await ctx.db.patch(args.id, { isArchived: true, updatedAt: Date.now() });
  },
});

export const unarchive = mutation({
  args: { id: v.id("tasks"), teamId: v.string() },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    const task = await ctx.db.get(args.id);
    if (task === null) {
      throw new Error("Task not found");
    }
    await ctx.db.patch(args.id, { isArchived: false, updatedAt: Date.now() });
  },
});

export const updateCrownError = mutation({
  args: {
    id: v.id("tasks"),
    crownEvaluationError: v.optional(v.string()),
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

// Set or update the generated pull request description for a task
export const setPullRequestDescription = mutation({
  args: {
    id: v.id("tasks"),
    pullRequestDescription: v.optional(v.string()),
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    const { id, pullRequestDescription } = args;
    await ctx.db.patch(id, {
      pullRequestDescription,
      updatedAt: Date.now(),
    });
  },
});

// Set or update the generated pull request title for a task
export const setPullRequestTitle = mutation({
  args: {
    id: v.id("tasks"),
    pullRequestTitle: v.optional(v.string()),
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    const { id, pullRequestTitle } = args;
    await ctx.db.patch(id, {
      pullRequestTitle,
      updatedAt: Date.now(),
    });
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
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    const existingVersions = await ctx.db
      .query("taskVersions")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("taskId"), args.taskId))
      .collect();

    const version = existingVersions.length + 1;

    const { userId } = await ensureAuth(ctx);
    const versionId = await ctx.db.insert("taskVersions", {
      taskId: args.taskId,
      version,
      diff: args.diff,
      summary: args.summary,
      files: args.files,
      createdAt: Date.now(),
      userId,
      teamId: args.teamId,
    });

    await ctx.db.patch(args.taskId, { updatedAt: Date.now() });

    return versionId;
  },
});

// Check if all runs for a task are completed and trigger crown evaluation
export const getTasksWithPendingCrownEvaluation = query({
  args: { teamId: v.string() },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    // Only get tasks that are pending, not already in progress
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId))
      .filter((q) =>
        q.eq(q.field("crownEvaluationError"), "pending_evaluation")
      )
      .collect();

    // Double-check that no evaluation exists for these tasks
    const tasksToEvaluate = [];
    for (const task of tasks) {
      const existingEvaluation = await ctx.db
        .query("crownEvaluations")
        .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId))
        .filter((q) => q.eq(q.field("taskId"), task._id))
        .first();

      if (!existingEvaluation) {
        tasksToEvaluate.push(task);
      }
    }

    return tasksToEvaluate;
  },
});

export const updateMergeStatus = mutation({
  args: {
    id: v.id("tasks"),
    mergeStatus: v.union(
      v.literal("none"),
      v.literal("pr_draft"),
      v.literal("pr_open"),
      v.literal("pr_approved"),
      v.literal("pr_changes_requested"),
      v.literal("pr_merged"),
      v.literal("pr_closed")
    ),
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    const task = await ctx.db.get(args.id);
    if (task === null) {
      throw new Error("Task not found");
    }
    await ctx.db.patch(args.id, {
      mergeStatus: args.mergeStatus,
      updatedAt: Date.now(),
    });
  },
});

export const checkAndEvaluateCrown = mutation({
  args: {
    taskId: v.id("tasks"),
    teamId: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"taskRuns"> | "pending" | null> => {
    await ensureAuth(ctx);
    // Get all runs for this task
    const taskRuns = await ctx.db
      .query("taskRuns")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("taskId"), args.taskId))
      .collect();

    console.log(`[CheckCrown] Task ${args.taskId} has ${taskRuns.length} runs`);
    console.log(
      `[CheckCrown] Run statuses:`,
      taskRuns.map((r) => ({
        id: r._id,
        status: r.status,
        isCrowned: r.isCrowned,
      }))
    );

    // Check if all runs are completed or failed
    const allCompleted = taskRuns.every(
      (run) => run.status === "completed" || run.status === "failed"
    );

    if (!allCompleted) {
      console.log(`[CheckCrown] Not all runs completed`);
      return null;
    }

    // Special handling for single agent scenario
    if (taskRuns.length === 1) {
      console.log(`[CheckCrown] Single agent scenario - marking task complete`);

      // Mark the task as completed
      await ctx.db.patch(args.taskId, {
        isCompleted: true,
        updatedAt: Date.now(),
      });

      // If the single run was successful, return it as the "winner" for potential auto-PR
      const singleRun = taskRuns[0];
      if (singleRun.status === "completed") {
        console.log(
          `[CheckCrown] Single agent completed successfully: ${singleRun._id}`
        );
        return singleRun._id;
      }

      return null;
    }

    // For multiple runs, require at least 2 to perform crown evaluation
    if (taskRuns.length < 2) {
      console.log(`[CheckCrown] Not enough runs (${taskRuns.length} < 2)`);
      return null;
    }

    // Check if we've already evaluated crown for this task
    const existingEvaluation = await ctx.db
      .query("crownEvaluations")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("taskId"), args.taskId))
      .first();

    if (existingEvaluation) {
      console.log(
        `[CheckCrown] Crown already evaluated for task ${args.taskId}, winner: ${existingEvaluation.winnerRunId}`
      );
      return existingEvaluation.winnerRunId;
    }

    // Check if crown evaluation is already pending or in progress
    const task = await ctx.db.get(args.taskId);
    if (
      task?.crownEvaluationError === "pending_evaluation" ||
      task?.crownEvaluationError === "in_progress"
    ) {
      console.log(
        `[CheckCrown] Crown evaluation already ${task.crownEvaluationError} for task ${args.taskId}`
      );
      return "pending";
    }

    console.log(
      `[CheckCrown] No existing evaluation, proceeding with crown evaluation`
    );

    // Only evaluate if we have at least 2 completed runs
    const completedRuns = taskRuns.filter((run) => run.status === "completed");
    if (completedRuns.length < 2) {
      console.log(
        `[CheckCrown] Not enough completed runs (${completedRuns.length} < 2)`
      );
      return null;
    }

    // Trigger crown evaluation with error handling
    let winnerId = null;
    try {
      console.log(
        `[CheckCrown] Starting crown evaluation for task ${args.taskId}`
      );
      winnerId = await ctx.runMutation(api.crown.evaluateAndCrownWinner, {
        taskId: args.taskId,
        teamId: args.teamId,
      });
      console.log(
        `[CheckCrown] Crown evaluation completed, winner: ${winnerId}`
      );
    } catch (error) {
      console.error(`[CheckCrown] Crown evaluation failed:`, error);
      // Store the error message on the task
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await ctx.db.patch(args.taskId, {
        crownEvaluationError: errorMessage,
        updatedAt: Date.now(),
      });
      // Continue to mark task as completed even if crown evaluation fails
    }

    // Mark the task as completed since all runs are done
    await ctx.db.patch(args.taskId, {
      isCompleted: true,
      updatedAt: Date.now(),
    });
    console.log(`[CheckCrown] Marked task ${args.taskId} as completed`);

    return winnerId;
  },
});
