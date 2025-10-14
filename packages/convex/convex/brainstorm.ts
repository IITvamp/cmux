import { v } from "convex/values";
import { resolveTeamIdLoose } from "../_shared/team";
import { authMutation, authQuery } from "./users/utils";

// Create a brainstorm session for a task
export const createSession = authMutation({
  args: {
    teamSlugOrId: v.string(),
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    // Verify task exists and belongs to user/team
    const task = await ctx.db.get(args.taskId);
    if (!task || task.teamId !== teamId || task.userId !== userId) {
      throw new Error("Task not found or unauthorized");
    }

    // Check if session already exists
    const existingSession = await ctx.db
      .query("brainstormSessions")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .first();

    if (existingSession) {
      return existingSession._id;
    }

    const now = Date.now();
    const sessionId = await ctx.db.insert("brainstormSessions", {
      taskId: args.taskId,
      status: "planning",
      createdAt: now,
      updatedAt: now,
      userId,
      teamId,
    });

    return sessionId;
  },
});

// Get brainstorm session for a task
export const getSession = authQuery({
  args: {
    teamSlugOrId: v.string(),
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const session = await ctx.db
      .query("brainstormSessions")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .filter((q) => q.eq(q.field("teamId"), teamId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    return session;
  },
});

// Get subtasks for a brainstorm session
export const getSubtasks = authQuery({
  args: {
    teamSlugOrId: v.string(),
    sessionId: v.id("brainstormSessions"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    // Verify session belongs to user/team
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.teamId !== teamId || session.userId !== userId) {
      throw new Error("Session not found or unauthorized");
    }

    const subtasks = await ctx.db
      .query("subtasks")
      .withIndex("by_session", (q) => q.eq("brainstormSessionId", args.sessionId))
      .collect();

    return subtasks;
  },
});

// Create a subtask
export const createSubtask = authMutation({
  args: {
    teamSlugOrId: v.string(),
    sessionId: v.id("brainstormSessions"),
    title: v.string(),
    description: v.optional(v.string()),
    prerequisites: v.optional(v.array(v.id("subtasks"))),
    estimatedHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    // Verify session belongs to user/team
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.teamId !== teamId || session.userId !== userId) {
      throw new Error("Session not found or unauthorized");
    }

    const now = Date.now();
    const subtaskId = await ctx.db.insert("subtasks", {
      brainstormSessionId: args.sessionId,
      title: args.title,
      description: args.description,
      status: "pending",
      prerequisites: args.prerequisites,
      estimatedHours: args.estimatedHours,
      createdAt: now,
      updatedAt: now,
      userId,
      teamId,
    });

    return subtaskId;
  },
});

// Update subtask
export const updateSubtask = authMutation({
  args: {
    teamSlugOrId: v.string(),
    subtaskId: v.id("subtasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("blocked")
    )),
    assignedTo: v.optional(v.string()),
    prerequisites: v.optional(v.array(v.id("subtasks"))),
    estimatedHours: v.optional(v.number()),
    actualHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask || subtask.teamId !== teamId || subtask.userId !== userId) {
      throw new Error("Subtask not found or unauthorized");
    }

    const updates: any = { updatedAt: Date.now() };
    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.status !== undefined) updates.status = args.status;
    if (args.assignedTo !== undefined) updates.assignedTo = args.assignedTo;
    if (args.prerequisites !== undefined) updates.prerequisites = args.prerequisites;
    if (args.estimatedHours !== undefined) updates.estimatedHours = args.estimatedHours;
    if (args.actualHours !== undefined) updates.actualHours = args.actualHours;

    await ctx.db.patch(args.subtaskId, updates);
  },
});

// Delete subtask
export const deleteSubtask = authMutation({
  args: {
    teamSlugOrId: v.string(),
    subtaskId: v.id("subtasks"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask || subtask.teamId !== teamId || subtask.userId !== userId) {
      throw new Error("Subtask not found or unauthorized");
    }

    await ctx.db.delete(args.subtaskId);
  },
});

// Update session status
export const updateSessionStatus = authMutation({
  args: {
    teamSlugOrId: v.string(),
    sessionId: v.id("brainstormSessions"),
    status: v.union(
      v.literal("planning"),
      v.literal("executing"),
      v.literal("completed")
    ),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.teamId !== teamId || session.userId !== userId) {
      throw new Error("Session not found or unauthorized");
    }

    await ctx.db.patch(args.sessionId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});