import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

function assertOwnership(
  resourceTeamId: string,
  resourceUserId: string,
  expectedTeamId: string,
  expectedUserId: string
) {
  if (resourceTeamId !== expectedTeamId || resourceUserId !== expectedUserId) {
    throw new Error("Unauthorized");
  }
}

export const workerContext = internalQuery({
  args: {
    taskRunId: v.id("taskRuns"),
    teamId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const taskRun = await ctx.db.get(args.taskRunId);
    if (!taskRun) {
      throw new Error("Task run not found");
    }
    assertOwnership(taskRun.teamId, taskRun.userId, args.teamId, args.userId);

    const task = await ctx.db.get(taskRun.taskId);
    if (!task) {
      throw new Error("Task not found");
    }
    assertOwnership(task.teamId, task.userId, args.teamId, args.userId);

    const runs = await ctx.db
      .query("taskRuns")
      .withIndex("by_task", (q) => q.eq("taskId", taskRun.taskId))
      .collect();

    runs.sort((a, b) => a.createdAt - b.createdAt);

    return {
      taskId: task._id,
      teamId: args.teamId,
      userId: args.userId,
      taskRunId: taskRun._id,
      task: {
        text: task.text ?? "",
        projectFullName: task.projectFullName ?? null,
        crownEvaluationError: task.crownEvaluationError ?? null,
      },
      runs: runs.map((run) => ({
        id: run._id,
        status: run.status,
        agentName: run.agentName ?? null,
        newBranch: run.newBranch ?? null,
        exitCode: run.exitCode ?? null,
        isCrowned: run.isCrowned ?? false,
        completedAt: run.completedAt ?? null,
      })),
      statistics: {
        totalRuns: runs.length,
        completedRuns: runs.filter((run) => run.status === "completed").length,
        allFinished: runs.every(
          (run) => run.status === "completed" || run.status === "failed"
        ),
      },
    };
  },
});

export const workerBegin = internalMutation({
  args: {
    taskId: v.id("tasks"),
    teamId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Task not found");
    }
    assertOwnership(task.teamId, task.userId, args.teamId, args.userId);

    if (task.crownEvaluationError === "in_progress") {
      return { acquired: false };
    }

    await ctx.db.patch(task._id, {
      crownEvaluationError: "in_progress",
      updatedAt: Date.now(),
    });

    return { acquired: true };
  },
});

export const workerFinalize = internalMutation({
  args: {
    taskId: v.id("tasks"),
    teamId: v.string(),
    userId: v.string(),
    winnerRunId: v.id("taskRuns"),
    reason: v.string(),
    candidateRunIds: v.array(v.id("taskRuns")),
    summaryText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Task not found");
    }
    assertOwnership(task.teamId, task.userId, args.teamId, args.userId);

    const winnerRun = await ctx.db.get(args.winnerRunId);
    if (!winnerRun) {
      throw new Error("Winner run not found");
    }
    if (winnerRun.taskId !== task._id) {
      throw new Error("Winner run mismatch");
    }

    const runs = await ctx.db
      .query("taskRuns")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .collect();

    const candidateIds = args.candidateRunIds as Id<"taskRuns">[];
    const candidateSet = new Set<Id<"taskRuns">>(candidateIds);
    for (const runId of candidateSet) {
      const run = runs.find((r) => r._id === runId);
      if (!run) {
        throw new Error("Unknown candidate run");
      }
    }

    const now = Date.now();

    await ctx.db.patch(winnerRun._id, {
      isCrowned: true,
      crownReason: args.reason,
      pullRequestUrl: "pending",
      updatedAt: now,
    });

    for (const run of runs) {
      if (run._id === winnerRun._id) continue;
      await ctx.db.patch(run._id, {
        isCrowned: false,
        crownReason: undefined,
        updatedAt: now,
      });
    }

    await ctx.db.patch(task._id, {
      crownEvaluationError: undefined,
      updatedAt: now,
      isCompleted: true,
    });

    await ctx.db.insert("crownEvaluations", {
      taskId: task._id,
      evaluatedAt: now,
      winnerRunId: winnerRun._id,
      candidateRunIds: Array.from(candidateSet),
      evaluationPrompt: "Evaluated via worker",
      evaluationResponse: args.reason,
      createdAt: now,
      userId: args.userId,
      teamId: args.teamId,
    });

    const summary = args.summaryText?.trim();
    if (summary) {
      const existingSummary = await ctx.db
        .query("taskComments")
        .withIndex("by_team_task", (q) =>
          q.eq("teamId", args.teamId).eq("taskId", task._id)
        )
        .filter((q) => q.eq(q.field("userId"), "cmux"))
        .order("desc")
        .first();

      if (!existingSummary) {
        await ctx.db.insert("taskComments", {
          taskId: task._id,
          content: summary,
          userId: "cmux",
          teamId: args.teamId,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  },
});

export const workerFail = internalMutation({
  args: {
    taskId: v.id("tasks"),
    teamId: v.string(),
    userId: v.string(),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Task not found");
    }
    assertOwnership(task.teamId, task.userId, args.teamId, args.userId);

    await ctx.db.patch(task._id, {
      crownEvaluationError: args.errorMessage,
      updatedAt: Date.now(),
    });
  },
});
