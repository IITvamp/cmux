import { v } from "convex/values";
import { mutation } from "../_generated/server";

// Mutation to mark a taskRun as the crown winner
export const crownWinner = mutation({
  args: {
    taskRunId: v.id("taskRuns"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const taskRun = await ctx.db.get(args.taskRunId);
    if (!taskRun) {
      throw new Error(`TaskRun not found: ${args.taskRunId}`);
    }

    // Mark this taskRun as crowned
    await ctx.db.patch(args.taskRunId, {
      isCrowned: true,
      crownReason: args.reason,
      updatedAt: Date.now(),
    });

    // Unmark any other taskRuns for the same task that might have been crowned
    const allTaskRuns = await ctx.db
      .query("taskRuns")
      .filter((q) => q.eq(q.field("taskId"), taskRun.taskId))
      .collect();

    for (const run of allTaskRuns) {
      if (run._id !== args.taskRunId && run.isCrowned) {
        await ctx.db.patch(run._id, {
          isCrowned: false,
          crownReason: undefined,
          updatedAt: Date.now(),
        });
      }
    }

    return { success: true };
  },
});