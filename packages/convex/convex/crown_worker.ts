import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const updateTaskRunStatusFromWorker = internalMutation({
  args: {
    taskRunId: v.id("taskRuns"),
    status: v.union(v.literal("complete"), v.literal("failed")),
    teamId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.taskRunId);
    if (!run) {
      throw new Error("Task run not found");
    }

    if (run.teamId !== args.teamId || run.userId !== args.userId) {
      throw new Error("Unauthorized to update this task run");
    }

    const now = Date.now();

    const existingStatus = await ctx.db
      .query("crownRunStatuses")
      .withIndex("by_taskRun", (q) => q.eq("taskRunId", args.taskRunId))
      .first();

    if (existingStatus) {
      if (existingStatus.status !== args.status) {
        await ctx.db.patch(existingStatus._id, {
          status: args.status,
          updatedAt: now,
        });
      } else {
        await ctx.db.patch(existingStatus._id, {
          updatedAt: now,
        });
      }
    } else {
      await ctx.db.insert("crownRunStatuses", {
        taskId: run.taskId,
        taskRunId: args.taskRunId,
        status: args.status,
        createdAt: now,
        updatedAt: now,
        userId: args.userId,
        teamId: args.teamId,
      });
    }

    const statusDocs = await ctx.db
      .query("crownRunStatuses")
      .withIndex("by_task", (q) => q.eq("taskId", run.taskId))
      .collect();

    const statusMap = new Map(statusDocs.map((doc) => [doc.taskRunId, doc.status]));

    const allRuns = await ctx.db
      .query("taskRuns")
      .withIndex("by_task", (q) => q.eq("taskId", run.taskId))
      .collect();

    const relevantRuns = allRuns.filter(
      (candidate) =>
        candidate.teamId === args.teamId && candidate.userId === args.userId
    );

    const completedRunIds: string[] = [];
    const failedRunIds: string[] = [];

    for (const candidate of relevantRuns) {
      const status = statusMap.get(candidate._id);
      if (status === "complete") {
        completedRunIds.push(candidate._id);
      } else if (status === "failed") {
        failedRunIds.push(candidate._id);
      }
    }

    const totalTracked = completedRunIds.length + failedRunIds.length;
    const totalRuns = relevantRuns.length;
    const allComplete = totalRuns > 0 && totalTracked === totalRuns;

    let requiresEvaluation = false;

    if (allComplete) {
      const task = await ctx.db.get(run.taskId);

      if (task) {
        await ctx.db.patch(run.taskId, {
          isCompleted: true,
          updatedAt: now,
        });

        const existingEvaluation = await ctx.db
          .query("crownEvaluations")
          .withIndex("by_task", (q) => q.eq("taskId", run.taskId))
          .first();

        if (!existingEvaluation) {
          const completedCount = completedRunIds.length;
          requiresEvaluation = completedCount >= 2;

          if (requiresEvaluation) {
            if (task.crownEvaluationError !== "in_progress") {
              await ctx.db.patch(run.taskId, {
                crownEvaluationError: "pending_evaluation",
                updatedAt: now,
              });
            }
          } else if (task.crownEvaluationError === "pending_evaluation") {
            await ctx.db.patch(run.taskId, {
              crownEvaluationError: undefined,
              updatedAt: now,
            });
          }
        }
      }
    }

    return {
      allComplete,
      requiresEvaluation,
      taskId: run.taskId,
      completedRunIds,
      failedRunIds,
      totalRuns,
    };
  },
});
