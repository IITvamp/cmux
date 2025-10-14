import { v } from "convex/values";
import { resolveTeamIdLoose } from "../_shared/team";
import type { Doc, Id } from "./_generated/dataModel";
import { authMutation, authQuery } from "./users/utils";

// Create a new brainstorm session
export const createSession = authMutation({
  args: {
    teamSlugOrId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    projectFullName: v.optional(v.string()),
    baseBranch: v.optional(v.string()),
    environmentId: v.optional(v.id("environments")),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    if (args.environmentId) {
      const environment = await ctx.db.get(args.environmentId);
      if (!environment || environment.teamId !== teamId) {
        throw new Error("Environment not found");
      }
    }

    const now = Date.now();
    const sessionId = await ctx.db.insert("brainstormSessions", {
      title: args.title,
      description: args.description,
      status: "planning",
      projectFullName: args.projectFullName,
      baseBranch: args.baseBranch,
      environmentId: args.environmentId,
      userId,
      teamId,
      createdAt: now,
      updatedAt: now,
    });

    // Create initial system message
    await ctx.db.insert("brainstormMessages", {
      sessionId,
      role: "system",
      content: `Brainstorm session started: **${args.title}**\n\n${args.description || "Let's break down this task into manageable subtasks."}`,
      userId,
      teamId,
      createdAt: now,
    });

    return sessionId;
  },
});

// Get a single brainstorm session
export const getSession = authQuery({
  args: {
    teamSlugOrId: v.string(),
    sessionId: v.id("brainstormSessions"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.teamId !== teamId || session.userId !== userId) {
      return null;
    }

    return session;
  },
});

// List brainstorm sessions for a user
export const listSessions = authQuery({
  args: {
    teamSlugOrId: v.string(),
    status: v.optional(
      v.union(
        v.literal("planning"),
        v.literal("ready"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("cancelled"),
      )
    ),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    let query = ctx.db
      .query("brainstormSessions")
      .withIndex("by_team_user", (q) =>
        q.eq("teamId", teamId).eq("userId", userId)
      );

    const results = await query.collect();

    // Filter by status if provided
    const filtered = args.status
      ? results.filter((s) => s.status === args.status)
      : results;

    return filtered.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Update session status
export const updateSessionStatus = authMutation({
  args: {
    teamSlugOrId: v.string(),
    sessionId: v.id("brainstormSessions"),
    status: v.union(
      v.literal("planning"),
      v.literal("ready"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.teamId !== teamId || session.userId !== userId) {
      throw new Error("Session not found or unauthorized");
    }

    const updates: Partial<Doc<"brainstormSessions">> = {
      status: args.status,
      updatedAt: Date.now(),
    };

    if (args.status === "completed") {
      updates.completedAt = Date.now();
    }

    await ctx.db.patch(args.sessionId, updates);
  },
});

// Add a message to the brainstorm session
export const addMessage = authMutation({
  args: {
    teamSlugOrId: v.string(),
    sessionId: v.id("brainstormSessions"),
    role: v.union(v.literal("user"), v.literal("agent"), v.literal("system")),
    content: v.string(),
    agentName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.teamId !== teamId || session.userId !== userId) {
      throw new Error("Session not found or unauthorized");
    }

    const messageId = await ctx.db.insert("brainstormMessages", {
      sessionId: args.sessionId,
      role: args.role,
      content: args.content,
      agentName: args.agentName,
      userId,
      teamId,
      createdAt: Date.now(),
    });

    // Update session timestamp
    await ctx.db.patch(args.sessionId, {
      updatedAt: Date.now(),
    });

    return messageId;
  },
});

// Get messages for a brainstorm session
export const getMessages = authQuery({
  args: {
    teamSlugOrId: v.string(),
    sessionId: v.id("brainstormSessions"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.teamId !== teamId || session.userId !== userId) {
      return [];
    }

    const messages = await ctx.db
      .query("brainstormMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    return messages.sort((a, b) => a.createdAt - b.createdAt);
  },
});

// Create a subtask
export const createSubtask = authMutation({
  args: {
    teamSlugOrId: v.string(),
    sessionId: v.id("brainstormSessions"),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.optional(v.number()),
    estimatedMinutes: v.optional(v.number()),
    assignedAgents: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.teamId !== teamId || session.userId !== userId) {
      throw new Error("Session not found or unauthorized");
    }

    const now = Date.now();
    const subtaskId = await ctx.db.insert("brainstormSubtasks", {
      sessionId: args.sessionId,
      title: args.title,
      description: args.description,
      status: "pending",
      priority: args.priority,
      estimatedMinutes: args.estimatedMinutes,
      assignedAgents: args.assignedAgents,
      userId,
      teamId,
      createdAt: now,
      updatedAt: now,
    });

    // Update session timestamp
    await ctx.db.patch(args.sessionId, {
      updatedAt: now,
    });

    return subtaskId;
  },
});

// Get subtasks for a session
export const getSubtasks = authQuery({
  args: {
    teamSlugOrId: v.string(),
    sessionId: v.id("brainstormSessions"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.teamId !== teamId || session.userId !== userId) {
      return [];
    }

    const subtasks = await ctx.db
      .query("brainstormSubtasks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    return subtasks.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
  },
});

// Update subtask
export const updateSubtask = authMutation({
  args: {
    teamSlugOrId: v.string(),
    subtaskId: v.id("brainstormSubtasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("blocked"),
        v.literal("ready"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("failed"),
      )
    ),
    priority: v.optional(v.number()),
    estimatedMinutes: v.optional(v.number()),
    assignedAgents: v.optional(v.array(v.string())),
    taskRunId: v.optional(v.id("taskRuns")),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask || subtask.teamId !== teamId || subtask.userId !== userId) {
      throw new Error("Subtask not found or unauthorized");
    }

    const { subtaskId, teamSlugOrId, ...updates } = args;

    const now = Date.now();
    const patchData: Partial<Doc<"brainstormSubtasks">> = {
      ...updates,
      updatedAt: now,
    };

    if (updates.status === "in_progress" && subtask.status !== "in_progress") {
      patchData.startedAt = now;
    }

    if (updates.status === "completed" && subtask.status !== "completed") {
      patchData.completedAt = now;
    }

    await ctx.db.patch(args.subtaskId, patchData);

    // Update session timestamp
    await ctx.db.patch(subtask.sessionId, {
      updatedAt: now,
    });
  },
});

// Delete subtask
export const deleteSubtask = authMutation({
  args: {
    teamSlugOrId: v.string(),
    subtaskId: v.id("brainstormSubtasks"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask || subtask.teamId !== teamId || subtask.userId !== userId) {
      throw new Error("Subtask not found or unauthorized");
    }

    // Delete dependencies
    const dependencies = await ctx.db
      .query("brainstormDependencies")
      .withIndex("by_subtask", (q) => q.eq("subtaskId", args.subtaskId))
      .collect();

    const reverseDependencies = await ctx.db
      .query("brainstormDependencies")
      .withIndex("by_depends_on", (q) => q.eq("dependsOnSubtaskId", args.subtaskId))
      .collect();

    for (const dep of [...dependencies, ...reverseDependencies]) {
      await ctx.db.delete(dep._id);
    }

    await ctx.db.delete(args.subtaskId);

    // Update session timestamp
    await ctx.db.patch(subtask.sessionId, {
      updatedAt: Date.now(),
    });
  },
});

// Create a dependency between subtasks
export const createDependency = authMutation({
  args: {
    teamSlugOrId: v.string(),
    sessionId: v.id("brainstormSessions"),
    subtaskId: v.id("brainstormSubtasks"),
    dependsOnSubtaskId: v.id("brainstormSubtasks"),
    type: v.optional(v.union(v.literal("blocks"), v.literal("related"))),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.teamId !== teamId || session.userId !== userId) {
      throw new Error("Session not found or unauthorized");
    }

    // Verify both subtasks exist and belong to this session
    const [subtask, dependsOnSubtask] = await Promise.all([
      ctx.db.get(args.subtaskId),
      ctx.db.get(args.dependsOnSubtaskId),
    ]);

    if (!subtask || subtask.sessionId !== args.sessionId) {
      throw new Error("Subtask not found or doesn't belong to this session");
    }

    if (!dependsOnSubtask || dependsOnSubtask.sessionId !== args.sessionId) {
      throw new Error("Depends-on subtask not found or doesn't belong to this session");
    }

    // Check for existing dependency
    const existing = await ctx.db
      .query("brainstormDependencies")
      .withIndex("by_subtask", (q) => q.eq("subtaskId", args.subtaskId))
      .filter((q) => q.eq(q.field("dependsOnSubtaskId"), args.dependsOnSubtaskId))
      .first();

    if (existing) {
      throw new Error("Dependency already exists");
    }

    const dependencyId = await ctx.db.insert("brainstormDependencies", {
      sessionId: args.sessionId,
      subtaskId: args.subtaskId,
      dependsOnSubtaskId: args.dependsOnSubtaskId,
      type: args.type ?? "blocks",
      userId,
      teamId,
      createdAt: Date.now(),
    });

    return dependencyId;
  },
});

// Get dependencies for a session
export const getDependencies = authQuery({
  args: {
    teamSlugOrId: v.string(),
    sessionId: v.id("brainstormSessions"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.teamId !== teamId || session.userId !== userId) {
      return [];
    }

    const dependencies = await ctx.db
      .query("brainstormDependencies")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    return dependencies;
  },
});

// Delete a dependency
export const deleteDependency = authMutation({
  args: {
    teamSlugOrId: v.string(),
    dependencyId: v.id("brainstormDependencies"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const dependency = await ctx.db.get(args.dependencyId);
    if (!dependency || dependency.teamId !== teamId || dependency.userId !== userId) {
      throw new Error("Dependency not found or unauthorized");
    }

    await ctx.db.delete(args.dependencyId);
  },
});

// Get complete session data (session + subtasks + dependencies + messages)
export const getSessionFull = authQuery({
  args: {
    teamSlugOrId: v.string(),
    sessionId: v.id("brainstormSessions"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.teamId !== teamId || session.userId !== userId) {
      return null;
    }

    const [subtasks, dependencies, messages] = await Promise.all([
      ctx.db
        .query("brainstormSubtasks")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .collect(),
      ctx.db
        .query("brainstormDependencies")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .collect(),
      ctx.db
        .query("brainstormMessages")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .collect(),
    ]);

    return {
      session,
      subtasks: subtasks.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999)),
      dependencies,
      messages: messages.sort((a, b) => a.createdAt - b.createdAt),
    };
  },
});

// Check if subtask dependencies are met
export const checkSubtaskReady = authQuery({
  args: {
    teamSlugOrId: v.string(),
    subtaskId: v.id("brainstormSubtasks"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask || subtask.teamId !== teamId || subtask.userId !== userId) {
      return { ready: false, blockingDependencies: [] };
    }

    // Get all blocking dependencies
    const dependencies = await ctx.db
      .query("brainstormDependencies")
      .withIndex("by_subtask", (q) => q.eq("subtaskId", args.subtaskId))
      .filter((q) => q.eq(q.field("type"), "blocks"))
      .collect();

    const blockingDependencies: Id<"brainstormSubtasks">[] = [];

    for (const dep of dependencies) {
      const dependsOnSubtask = await ctx.db.get(dep.dependsOnSubtaskId);
      if (dependsOnSubtask && dependsOnSubtask.status !== "completed") {
        blockingDependencies.push(dep.dependsOnSubtaskId);
      }
    }

    return {
      ready: blockingDependencies.length === 0,
      blockingDependencies,
    };
  },
});
