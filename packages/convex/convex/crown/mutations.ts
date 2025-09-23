import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

// Mark a task run as crowned
export const markRunAsCrowned = internalMutation({
  args: {
    taskRunId: v.id("taskRuns"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskRunId, {
      isCrowned: true,
      crownReason: args.reason,
      updatedAt: Date.now(),
    });
  },
});

// Record crown evaluation
export const recordEvaluation = internalMutation({
  args: {
    taskId: v.id("tasks"),
    winnerRunId: v.id("taskRuns"),
    candidateRunIds: v.array(v.id("taskRuns")),
    evaluationPrompt: v.string(),
    evaluationResponse: v.string(),
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the task to get userId
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error(`Task ${args.taskId} not found`);
    }

    await ctx.db.insert("crownEvaluations", {
      taskId: args.taskId,
      evaluatedAt: Date.now(),
      winnerRunId: args.winnerRunId,
      candidateRunIds: args.candidateRunIds,
      evaluationPrompt: args.evaluationPrompt,
      evaluationResponse: args.evaluationResponse,
      createdAt: Date.now(),
      userId: task.userId,
      teamId: args.teamId,
    });
  },
});