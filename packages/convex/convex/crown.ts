import { v } from "convex/values";
import { authMutation as mutation, authQuery as query } from "../_shared/auth";
import { ensureAuth } from "../_shared/ensureAuth";

export const evaluateAndCrownWinner = mutation({
  args: {
    taskId: v.id("tasks"),
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    try {
      console.log(`[Crown] ============================================`);
      console.log(`[Crown] EVALUATE AND CROWN WINNER CALLED`);
      console.log(`[Crown] Task ID: ${args.taskId}`);
      console.log(`[Crown] ============================================`);
      
      const task = await ctx.db.get(args.taskId);
      if (!task) {
        console.error(`[Crown] Task ${args.taskId} not found`);
        throw new Error("Task not found");
      }

      // Get all completed runs for this task within team
      const taskRuns = await ctx.db
        .query("taskRuns")
        .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId))
        .filter((q) => q.eq(q.field("taskId"), args.taskId))
        .filter((q) => q.eq(q.field("status"), "completed"))
        .collect();

      console.log(`[Crown] Found ${taskRuns.length} completed runs for task ${args.taskId}`);

      // If only one model or less, crown it by default
      if (taskRuns.length <= 1) {
        if (taskRuns.length === 1) {
          await ctx.db.patch(taskRuns[0]._id, {
            isCrowned: true,
            crownReason: "Only one model completed the task",
          });
        }
        return taskRuns[0]?._id || null;
      }

      // Only evaluate if 2+ models completed
      if (taskRuns.length < 2) {
        return null;
      }

      // Check if evaluation already exists or is pending
      const existingEvaluation = await ctx.db
        .query("crownEvaluations")
        .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId))
        .filter((q) => q.eq(q.field("taskId"), args.taskId))
        .first();
      
      if (existingEvaluation) {
        console.log(`[Crown] Evaluation already exists for task ${args.taskId}, returning winner`);
        return existingEvaluation.winnerRunId;
      }
      
      // Check if already marked for evaluation
      if (task.crownEvaluationError === "pending_evaluation" || 
          task.crownEvaluationError === "in_progress") {
        console.log(`[Crown] Task ${args.taskId} already marked for evaluation (${task.crownEvaluationError})`);
        return "pending";
      }

      // Mark that crown evaluation is needed
      // The server will handle the actual evaluation using Claude Code
      await ctx.db.patch(args.taskId, {
        crownEvaluationError: "pending_evaluation",
        updatedAt: Date.now(),
      });

      console.log(`[Crown] Marked task ${args.taskId} for crown evaluation`);
      return "pending";

    } catch (error) {
      console.error(`[Crown] Crown evaluation failed for task ${args.taskId}:`, error);
      throw error;
    }
  },
});

export const setCrownWinner = mutation({
  args: {
    taskRunId: v.id("taskRuns"),
    reason: v.string(),
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    console.log(`[Crown] ============================================`);
    console.log(`[Crown] SET CROWN WINNER CALLED`);
    console.log(`[Crown] Task Run ID: ${args.taskRunId}`);
    console.log(`[Crown] Reason: ${args.reason}`);
    console.log(`[Crown] ============================================`);
    
    const taskRun = await ctx.db.get(args.taskRunId);
    if (!taskRun) {
      throw new Error("Task run not found");
    }

    // Get all runs for this task (scoped by team)
    const taskRuns = await ctx.db
      .query("taskRuns")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("taskId"), taskRun.taskId))
      .collect();

    // Update the selected run as crowned
    await ctx.db.patch(args.taskRunId, {
      isCrowned: true,
      crownReason: args.reason,
    });

    // Update other runs to ensure they're not crowned
    for (const run of taskRuns) {
      if (run._id !== args.taskRunId) {
        await ctx.db.patch(run._id, {
          isCrowned: false,
        });
      }
    }

    // Clear crown evaluation error
    await ctx.db.patch(taskRun.taskId, {
      crownEvaluationError: undefined,
      updatedAt: Date.now(),
    });

    // Create evaluation record
    const { userId } = await ensureAuth(ctx);
    await ctx.db.insert("crownEvaluations", {
      taskId: taskRun.taskId,
      evaluatedAt: Date.now(),
      winnerRunId: args.taskRunId,
      candidateRunIds: taskRuns.map((r) => r._id),
      evaluationPrompt: "Evaluated by Claude Code",
      evaluationResponse: args.reason,
      createdAt: Date.now(),
      userId,
      teamId: args.teamId,
    });

    // Mark PR creation needed
    await ctx.db.patch(args.taskRunId, {
      pullRequestUrl: "pending",
    });

    return args.taskRunId;
  },
});

export const getCrownedRun = query({
  args: {
    taskId: v.id("tasks"),
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    const crownedRun = await ctx.db
      .query("taskRuns")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("taskId"), args.taskId))
      .filter((q) => q.eq(q.field("isCrowned"), true))
      .first();

    console.log(`[Crown] getCrownedRun for task ${args.taskId}: ${crownedRun ? `found ${crownedRun._id}` : 'not found'}`);
    
    return crownedRun;
  },
});

export const getCrownEvaluation = query({
  args: {
    taskId: v.id("tasks"),
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureAuth(ctx);
    const evaluation = await ctx.db
      .query("crownEvaluations")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("taskId"), args.taskId))
      .first();

    return evaluation;
  },
});

