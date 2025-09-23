import { v } from "convex/values";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { mutation, query, internalQuery } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";

export const markTaskRunComplete = mutation({
  args: {
    taskRunId: v.id("taskRuns"),
    exitCode: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { taskRunId, exitCode, errorMessage } = args;

    // Get the task run
    const taskRun = await ctx.db.get(taskRunId);
    if (!taskRun) {
      throw new Error(`TaskRun ${taskRunId} not found`);
    }

    // Check if already completed to avoid double processing
    if (taskRun.status === "completed" || taskRun.status === "failed") {
      return {
        alreadyCompleted: true,
        taskId: taskRun.taskId,
        shouldEvaluate: false
      };
    }

    // Update the task run status
    const now = Date.now();
    const status = errorMessage ? "failed" : "completed";

    await ctx.db.patch(taskRunId, {
      status,
      completedAt: now,
      updatedAt: now,
      exitCode: exitCode ?? 0,
      ...(errorMessage && { errorMessage }),
    });

    // Check if we should trigger crown evaluation
    const shouldEvaluate = await checkShouldEvaluateCrown(ctx, taskRun.taskId);

    return {
      alreadyCompleted: false,
      taskId: taskRun.taskId,
      shouldEvaluate,
    };
  },
});

async function checkShouldEvaluateCrown(
  ctx: any,
  taskId: Id<"tasks">
): Promise<boolean> {
  // Get the task
  const task = await ctx.db.get(taskId);
  if (!task) {
    console.warn(`Task ${taskId} not found`);
    return false;
  }

  // If task is already completed or being evaluated, skip
  if (task.isCompleted || task.crownEvaluationError === "in_progress") {
    return false;
  }

  // Get all task runs for this task
  const taskRuns = await ctx.db
    .query("taskRuns")
    .withIndex("by_task", (q) => q.eq("taskId", taskId))
    .collect();

  // Filter to valid runs (not failed)
  const validRuns = taskRuns.filter(run => run.status !== "failed");

  // Single agent case - no crown evaluation needed
  if (validRuns.length === 1 && validRuns[0].status === "completed") {
    // Mark the single run as crowned
    await ctx.db.patch(validRuns[0]._id, {
      isCrowned: true,
      crownReason: "Single agent completed successfully",
    });

    // Mark task as completed
    await ctx.db.patch(taskId, {
      isCompleted: true,
    });

    return false; // No crown evaluation needed
  }

  // Multiple agents - check if all are completed
  const allCompleted = validRuns.every(run => run.status === "completed");
  const hasMultipleCompleted = validRuns.filter(run => run.status === "completed").length >= 2;

  return allCompleted && hasMultipleCompleted;
}

export const getAllTaskRunsStatus = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const { taskId } = args;

    const task = await ctx.db.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const taskRuns = await ctx.db
      .query("taskRuns")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .collect();

    const validRuns = taskRuns.filter(run => run.status !== "failed");
    const completedRuns = validRuns.filter(run => run.status === "completed");
    const hasCrownedRun = validRuns.some(run => run.isCrowned === true);

    return {
      task,
      taskRuns,
      validRunCount: validRuns.length,
      completedCount: completedRuns.length,
      allCompleted: validRuns.length > 0 && validRuns.every(run => run.status === "completed"),
      hasCrownedRun,
      isEvaluating: task.crownEvaluationError === "in_progress",
      needsEvaluation:
        !hasCrownedRun &&
        !task.isCompleted &&
        task.crownEvaluationError !== "in_progress" &&
        completedRuns.length >= 2 &&
        validRuns.every(run => run.status === "completed"),
    };
  },
});

export const tryBeginCrownEvaluation = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const { taskId } = args;

    const task = await ctx.db.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Check if already evaluating or completed
    if (task.crownEvaluationError === "in_progress" || task.isCompleted) {
      return { acquired: false, reason: "Already evaluating or completed" };
    }

    // Get task runs to verify we should evaluate
    const taskRuns = await ctx.db
      .query("taskRuns")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .collect();

    const validRuns = taskRuns.filter(run => run.status !== "failed");
    const completedRuns = validRuns.filter(run => run.status === "completed");

    // Verify conditions for crown evaluation
    if (completedRuns.length < 2 || !validRuns.every(run => run.status === "completed")) {
      return { acquired: false, reason: "Not all runs completed or less than 2 valid runs" };
    }

    // Atomically acquire the lock by setting status
    await ctx.db.patch(taskId, {
      crownEvaluationError: "in_progress",
    });

    return {
      acquired: true,
      taskId,
      completedRunIds: completedRuns.map(run => run._id),
    };
  },
});

export const completeCrownEvaluation = mutation({
  args: {
    taskId: v.id("tasks"),
    winnerRunId: v.id("taskRuns"),
    reason: v.string(),
    evaluationId: v.optional(v.id("crownEvaluations")),
  },
  handler: async (ctx, args) => {
    const { taskId, winnerRunId, reason, evaluationId } = args;

    // Mark the winning run
    await ctx.db.patch(winnerRunId, {
      isCrowned: true,
      crownReason: reason,
    });

    // Mark task as completed and clear evaluation status
    await ctx.db.patch(taskId, {
      isCompleted: true,
      crownEvaluationError: undefined,
    });

    // Get all runs to unmark non-winners
    const taskRuns = await ctx.db
      .query("taskRuns")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .collect();

    for (const run of taskRuns) {
      if (run._id !== winnerRunId && run.isCrowned) {
        await ctx.db.patch(run._id, {
          isCrowned: false,
          crownReason: undefined,
        });
      }
    }

    return { success: true, evaluationId };
  },
});

export const failCrownEvaluation = mutation({
  args: {
    taskId: v.id("tasks"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const { taskId, error } = args;

    // Store the error and clear in_progress status
    await ctx.db.patch(taskId, {
      crownEvaluationError: error,
    });

    return { success: true };
  },
});

export const createCrownEvaluation = mutation({
  args: {
    taskId: v.id("tasks"),
    winnerRunId: v.id("taskRuns"),
    candidateRunIds: v.array(v.id("taskRuns")),
    evaluationPrompt: v.string(),
    evaluationResponse: v.string(),
    llmReasoningTrace: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error(`Task ${args.taskId} not found`);
    }

    const evaluationId = await ctx.db.insert("crownEvaluations", {
      taskId: args.taskId,
      evaluatedAt: Date.now(),
      winnerRunId: args.winnerRunId,
      candidateRunIds: args.candidateRunIds,
      evaluationPrompt: args.evaluationPrompt,
      evaluationResponse: args.evaluationResponse,
      createdAt: Date.now(),
      userId: task.userId,
      teamId: task.teamId,
    });

    return evaluationId;
  },
});

// Helper queries for direct access
export const getTaskById = internalQuery({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.taskId);
  },
});

export const getTaskRunsByIds = internalQuery({
  args: {
    runIds: v.array(v.id("taskRuns")),
  },
  handler: async (ctx, args) => {
    const runs = [];
    for (const runId of args.runIds) {
      const run = await ctx.db.get(runId);
      if (run) {
        runs.push(run);
      }
    }
    return runs;
  },
});

// Mutation with retry wrapper for robustness
export const markTaskRunCompleteWithRetry = mutation({
  args: {
    taskRunId: v.id("taskRuns"),
    exitCode: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Get the task run
        const taskRun = await ctx.db.get(args.taskRunId);
        if (!taskRun) {
          throw new Error(`TaskRun ${args.taskRunId} not found`);
        }

        // Check if already completed to avoid double processing
        if (taskRun.status === "completed" || taskRun.status === "failed") {
          return {
            alreadyCompleted: true,
            taskId: taskRun.taskId,
            shouldEvaluate: false
          };
        }

        // Update the task run status
        const now = Date.now();
        const status = args.errorMessage ? "failed" : "completed";

        await ctx.db.patch(args.taskRunId, {
          status,
          completedAt: now,
          updatedAt: now,
          exitCode: args.exitCode ?? 0,
          ...(args.errorMessage && { errorMessage: args.errorMessage }),
        });

        // Check if we should trigger crown evaluation
        const shouldEvaluate = await checkShouldEvaluateCrown(ctx, taskRun.taskId);

        return {
          alreadyCompleted: false,
          taskId: taskRun.taskId,
          shouldEvaluate,
        };
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries - 1) {
          // Wait with exponential backoff before retrying
          const delay = Math.pow(2, attempt) * 100; // 100ms, 200ms, 400ms
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    throw lastError;
  },
});