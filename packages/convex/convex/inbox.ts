import { v } from "convex/values";
import { getTeamId } from "../_shared/team";
import { authQuery } from "./users/utils";

export const getRecentlyCompletedTasks = authQuery({
  args: {
    teamSlugOrId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await getTeamId(ctx, args.teamSlugOrId);
    const limit = args.limit || 50;

    // Get tasks that are completed
    const completedTasks = await ctx.db
      .query("tasks")
      .withIndex("by_team_user", (q) => q.eq("teamId", teamId).eq("userId", userId))
      .filter((q) => q.eq(q.field("isCompleted"), true))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .order("desc")
      .take(limit);

    // For each task, get its most recent completed run and crown status
    const tasksWithRuns = await Promise.all(
      completedTasks.map(async (task) => {
        // Get all runs for this task
        const runs = await ctx.db
          .query("taskRuns")
          .withIndex("by_team_user", (q) =>
            q.eq("teamId", teamId).eq("userId", userId)
          )
          .filter((q) => q.eq(q.field("taskId"), task._id))
          .filter((q) => q.eq(q.field("status"), "completed"))
          .collect();

        // Sort runs by completedAt timestamp (most recent first)
        const sortedRuns = runs.sort((a, b) => 
          (b.completedAt || b.updatedAt || 0) - (a.completedAt || a.updatedAt || 0)
        );

        // Find the crowned run if any
        const crownedRun = runs.find(run => run.isCrowned === true);

        // Check if crown evaluation is pending
        const isPendingCrownEvaluation = 
          task.crownEvaluationError === "pending_evaluation" || 
          task.crownEvaluationError === "in_progress";

        // Get crown evaluation if exists
        const crownEvaluation = await ctx.db
          .query("crownEvaluations")
          .withIndex("by_task", (q) => q.eq("taskId", task._id))
          .first();

        return {
          task,
          runs: sortedRuns,
          latestRun: sortedRuns[0],
          crownedRun,
          isPendingCrownEvaluation,
          crownEvaluation,
          // Use the latest run's completedAt for sorting
          completedAt: sortedRuns[0]?.completedAt || sortedRuns[0]?.updatedAt || task.updatedAt,
        };
      })
    );

    // Sort by completedAt timestamp (most recent first)
    tasksWithRuns.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

    return tasksWithRuns;
  },
});