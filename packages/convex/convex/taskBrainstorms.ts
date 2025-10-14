import { v } from "convex/values";
import { resolveTeamIdLoose } from "../_shared/team";
import {
  authMutation,
  authQuery,
} from "./users/utils";
import type {
  Doc,
  Id,
} from "./_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "./_generated/server";

type BrainstormStatus = "draft" | "active" | "complete";

type AuthCtx = QueryCtx | MutationCtx;

type BrainstormWithDetails = Doc<"taskBrainstorms"> & {
  messages: Doc<"taskBrainstormMessages">[];
  subtasks: Array<
    Doc<"taskBrainstormSubtasks"> & {
      dependencyIds: Id<"taskBrainstormSubtasks">[];
    }
  >;
};

type NullableString = string | null;

type UpdateBrainstormParams = {
  title?: NullableString;
  objective?: NullableString;
  status?: BrainstormStatus;
};

function assertStringArray(values: string[] | undefined): string[] | undefined {
  if (!values) {
    return undefined;
  }
  const trimmed = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (trimmed.length === 0) {
    return [];
  }
  return Array.from(new Set(trimmed));
}

async function ensureTaskOwnership(
  ctx: AuthCtx,
  teamId: string,
  userId: string,
  taskId: Id<"tasks">,
): Promise<Doc<"tasks">> {
  const task = await ctx.db.get(taskId);
  if (!task || task.teamId !== teamId || task.userId !== userId) {
    throw new Error("Task not found or unauthorized");
  }
  return task;
}

async function ensureBrainstormOwnership(
  ctx: AuthCtx,
  teamId: string,
  userId: string,
  brainstormId: Id<"taskBrainstorms">,
): Promise<Doc<"taskBrainstorms">> {
  const brainstorm = await ctx.db.get(brainstormId);
  if (!brainstorm || brainstorm.teamId !== teamId || brainstorm.userId !== userId) {
    throw new Error("Brainstorm not found or unauthorized");
  }
  return brainstorm;
}

function coerceNullableString(value: NullableString | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function maybeCoerceNumber(value: number | null | undefined): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return value;
}

export const startForTask = authMutation({
  args: {
    teamSlugOrId: v.string(),
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    objective: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("active"),
        v.literal("complete"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const identity = ctx.identity;
    const userId = identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    await ensureTaskOwnership(ctx, teamId, userId, args.taskId);

    const existing = await ctx.db
      .query("taskBrainstorms")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .filter((q) => q.eq(q.field("teamId"), teamId))
      .first();

    const now = Date.now();
    const normalizedTitle = coerceNullableString(args.title);
    const normalizedObjective = coerceNullableString(args.objective);
    const resolvedStatus: BrainstormStatus = args.status ?? "active";

    if (existing) {
      const updates: Partial<Doc<"taskBrainstorms">> = {};
      if (normalizedTitle !== undefined) {
        updates.title = normalizedTitle;
      }
      if (normalizedObjective !== undefined) {
        updates.objective = normalizedObjective;
      }
      if (args.status) {
        updates.status = resolvedStatus;
      }
      updates.updatedAt = now;
      await ctx.db.patch(existing._id, updates);
      await ctx.db.patch(args.taskId, { updatedAt: now });
      return existing._id;
    }

    const brainstormId = await ctx.db.insert("taskBrainstorms", {
      taskId: args.taskId,
      teamId,
      userId,
      title: normalizedTitle,
      objective: normalizedObjective,
      status: resolvedStatus,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.taskId, { updatedAt: now });

    return brainstormId;
  },
});

export const update = authMutation({
  args: {
    teamSlugOrId: v.string(),
    brainstormId: v.id("taskBrainstorms"),
    title: v.optional(v.union(v.string(), v.null())),
    objective: v.optional(v.union(v.string(), v.null())),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("active"),
        v.literal("complete"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const identity = ctx.identity;
    const userId = identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const brainstorm = await ensureBrainstormOwnership(
      ctx,
      teamId,
      userId,
      args.brainstormId,
    );

    const updates: UpdateBrainstormParams = {};
    const normalizedTitle = coerceNullableString(args.title ?? undefined);
    const normalizedObjective = coerceNullableString(args.objective ?? undefined);

    if (args.title !== undefined) {
      updates.title = args.title === null ? null : normalizedTitle ?? null;
    }
    if (args.objective !== undefined) {
      updates.objective =
        args.objective === null ? null : normalizedObjective ?? null;
    }
    if (args.status) {
      updates.status = args.status;
    }

    if (
      updates.title === undefined &&
      updates.objective === undefined &&
      updates.status === undefined
    ) {
      return brainstorm._id;
    }

    const now = Date.now();
    await ctx.db.patch(args.brainstormId, {
      ...(updates.title !== undefined ? { title: updates.title ?? undefined } : {}),
      ...(updates.objective !== undefined
        ? { objective: updates.objective ?? undefined }
        : {}),
      ...(updates.status ? { status: updates.status } : {}),
      updatedAt: now,
    });

    await ctx.db.patch(brainstorm.taskId, { updatedAt: now });

    return args.brainstormId;
  },
});

export const getByTask = authQuery({
  args: {
    teamSlugOrId: v.string(),
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args): Promise<BrainstormWithDetails | null> => {
    const identity = ctx.identity;
    const userId = identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    await ensureTaskOwnership(ctx, teamId, userId, args.taskId);

    const brainstorm = await ctx.db
      .query("taskBrainstorms")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .filter((q) => q.eq(q.field("teamId"), teamId))
      .first();

    if (!brainstorm) {
      return null;
    }

    const messages = await ctx.db
      .query("taskBrainstormMessages")
      .withIndex("by_brainstorm", (q) => q.eq("brainstormId", brainstorm._id))
      .order("asc")
      .collect();

    const subtasks = await ctx.db
      .query("taskBrainstormSubtasks")
      .withIndex("by_brainstorm", (q) => q.eq("brainstormId", brainstorm._id))
      .order("asc")
      .collect();

    const dependencies = await ctx.db
      .query("taskBrainstormDependencies")
      .withIndex("by_brainstorm", (q) => q.eq("brainstormId", brainstorm._id))
      .collect();

    const dependencyMap = new Map<
      Id<"taskBrainstormSubtasks">,
      Id<"taskBrainstormSubtasks">[]
    >();
    for (const dependency of dependencies) {
      const existingDeps = dependencyMap.get(dependency.subtaskId) ?? [];
      dependencyMap.set(dependency.subtaskId, [
        ...existingDeps,
        dependency.dependsOnSubtaskId,
      ]);
    }

    return {
      ...brainstorm,
      messages,
      subtasks: subtasks.map((subtask) => ({
        ...subtask,
        dependencyIds: dependencyMap.get(subtask._id) ?? [],
      })),
    };
  },
});

export const listSummaries = authQuery({
  args: {
    teamSlugOrId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = ctx.identity;
    const userId = identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const brainstorms = await ctx.db
      .query("taskBrainstorms")
      .withIndex("by_team_user", (q) =>
        q.eq("teamId", teamId).eq("userId", userId),
      )
      .collect();

    return brainstorms.map((brainstorm) => ({
      taskId: brainstorm.taskId,
      brainstormId: brainstorm._id,
      status: brainstorm.status,
      updatedAt: brainstorm.updatedAt,
    }));
  },
});

export const addMessage = authMutation({
  args: {
    teamSlugOrId: v.string(),
    brainstormId: v.id("taskBrainstorms"),
    authorType: v.union(
      v.literal("user"),
      v.literal("agent"),
      v.literal("system"),
    ),
    content: v.string(),
    agentName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = ctx.identity;
    const userId = identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const brainstorm = await ensureBrainstormOwnership(
      ctx,
      teamId,
      userId,
      args.brainstormId,
    );

    const now = Date.now();
    const sanitizedContent = args.content.trim();
    if (sanitizedContent.length === 0) {
      throw new Error("Message content cannot be empty");
    }

    const record = await ctx.db.insert("taskBrainstormMessages", {
      brainstormId: args.brainstormId,
      teamId,
      taskId: brainstorm.taskId,
      authorType: args.authorType,
      authorUserId: args.authorType === "user" ? userId : undefined,
      agentName:
        args.authorType === "agent"
          ? args.agentName?.trim() || "Agent"
          : args.agentName?.trim(),
      content: sanitizedContent,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.brainstormId, { updatedAt: now });
    await ctx.db.patch(brainstorm.taskId, { updatedAt: now });

    return record;
  },
});

export const createSubtask = authMutation({
  args: {
    teamSlugOrId: v.string(),
    brainstormId: v.id("taskBrainstorms"),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("planned"),
        v.literal("assigned"),
        v.literal("in_progress"),
        v.literal("blocked"),
        v.literal("done"),
      ),
    ),
    assignedAgentNames: v.optional(v.array(v.string())),
    linkedTaskId: v.optional(v.id("tasks")),
    estimatedMinutes: v.optional(v.number()),
    dueAt: v.optional(v.number()),
    sprintLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = ctx.identity;
    const userId = identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const brainstorm = await ensureBrainstormOwnership(
      ctx,
      teamId,
      userId,
      args.brainstormId,
    );

    if (args.linkedTaskId) {
      await ensureTaskOwnership(ctx, teamId, userId, args.linkedTaskId);
    }

    const now = Date.now();

    const [last] = await ctx.db
      .query("taskBrainstormSubtasks")
      .withIndex("by_brainstorm", (q) => q.eq("brainstormId", args.brainstormId))
      .order("desc")
      .take(1);

    const nextSequence = last ? last.sequence + 1 : 1;
    const sanitizedAgents = assertStringArray(args.assignedAgentNames);

    const subtaskId = await ctx.db.insert("taskBrainstormSubtasks", {
      brainstormId: args.brainstormId,
      taskId: brainstorm.taskId,
      teamId,
      title: args.title.trim(),
      description: coerceNullableString(args.description ?? undefined),
      status: args.status ?? "planned",
      sequence: nextSequence,
      assignedAgentNames: sanitizedAgents,
      linkedTaskId: args.linkedTaskId,
      estimatedMinutes: maybeCoerceNumber(args.estimatedMinutes),
      dueAt: maybeCoerceNumber(args.dueAt),
      sprintLabel: coerceNullableString(args.sprintLabel ?? undefined),
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.brainstormId, { updatedAt: now });
    await ctx.db.patch(brainstorm.taskId, { updatedAt: now });

    return subtaskId;
  },
});

export const updateSubtask = authMutation({
  args: {
    teamSlugOrId: v.string(),
    subtaskId: v.id("taskBrainstormSubtasks"),
    title: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    status: v.optional(
      v.union(
        v.literal("planned"),
        v.literal("assigned"),
        v.literal("in_progress"),
        v.literal("blocked"),
        v.literal("done"),
      ),
    ),
    assignedAgentNames: v.optional(v.array(v.string())),
    linkedTaskId: v.optional(v.union(v.id("tasks"), v.null())),
    estimatedMinutes: v.optional(v.union(v.number(), v.null())),
    dueAt: v.optional(v.union(v.number(), v.null())),
    sprintLabel: v.optional(v.union(v.string(), v.null())),
    sequence: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = ctx.identity;
    const userId = identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask || subtask.teamId !== teamId) {
      throw new Error("Subtask not found or unauthorized");
    }

    const brainstorm = await ensureBrainstormOwnership(
      ctx,
      teamId,
      userId,
      subtask.brainstormId,
    );

    if (args.linkedTaskId && args.linkedTaskId !== null) {
      await ensureTaskOwnership(ctx, teamId, userId, args.linkedTaskId);
    }

    const updates: Partial<Doc<"taskBrainstormSubtasks">> = {};

    if (args.title !== undefined) {
      updates.title = args.title.trim();
    }
    if (args.description !== undefined) {
      updates.description =
        args.description === null
          ? undefined
          : coerceNullableString(args.description ?? undefined);
    }
    if (args.status) {
      updates.status = args.status;
    }
    if (args.assignedAgentNames !== undefined) {
      updates.assignedAgentNames = assertStringArray(args.assignedAgentNames);
    }
    if (args.linkedTaskId !== undefined) {
      updates.linkedTaskId = args.linkedTaskId ?? undefined;
    }
    if (args.estimatedMinutes !== undefined) {
      updates.estimatedMinutes = maybeCoerceNumber(args.estimatedMinutes);
    }
    if (args.dueAt !== undefined) {
      updates.dueAt = maybeCoerceNumber(args.dueAt);
    }
    if (args.sprintLabel !== undefined) {
      updates.sprintLabel =
        args.sprintLabel === null
          ? undefined
          : coerceNullableString(args.sprintLabel ?? undefined);
    }
    if (args.sequence !== undefined) {
      updates.sequence = args.sequence;
    }

    if (Object.keys(updates).length === 0) {
      return args.subtaskId;
    }

    const now = Date.now();

    await ctx.db.patch(args.subtaskId, {
      ...updates,
      updatedAt: now,
    });

    await ctx.db.patch(subtask.brainstormId, { updatedAt: now });
    await ctx.db.patch(brainstorm.taskId, { updatedAt: now });

    return args.subtaskId;
  },
});

export const deleteSubtask = authMutation({
  args: {
    teamSlugOrId: v.string(),
    subtaskId: v.id("taskBrainstormSubtasks"),
  },
  handler: async (ctx, args) => {
    const identity = ctx.identity;
    const userId = identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask || subtask.teamId !== teamId) {
      throw new Error("Subtask not found or unauthorized");
    }

    const brainstorm = await ensureBrainstormOwnership(
      ctx,
      teamId,
      userId,
      subtask.brainstormId,
    );

    const dependencies = await ctx.db
      .query("taskBrainstormDependencies")
      .withIndex("by_subtask", (q) => q.eq("subtaskId", args.subtaskId))
      .collect();

    for (const dependency of dependencies) {
      await ctx.db.delete(dependency._id);
    }

    const reverseDependencies = await ctx.db
      .query("taskBrainstormDependencies")
      .withIndex("by_dependency", (q) => q.eq("dependsOnSubtaskId", args.subtaskId))
      .collect();

    for (const dependency of reverseDependencies) {
      await ctx.db.delete(dependency._id);
    }

    await ctx.db.delete(args.subtaskId);

    const now = Date.now();
    await ctx.db.patch(subtask.brainstormId, { updatedAt: now });
    await ctx.db.patch(brainstorm.taskId, { updatedAt: now });
  },
});

export const setSubtaskDependencies = authMutation({
  args: {
    teamSlugOrId: v.string(),
    subtaskId: v.id("taskBrainstormSubtasks"),
    dependsOn: v.array(v.id("taskBrainstormSubtasks")),
  },
  handler: async (ctx, args) => {
    const identity = ctx.identity;
    const userId = identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask || subtask.teamId !== teamId) {
      throw new Error("Subtask not found or unauthorized");
    }

    const brainstorm = await ensureBrainstormOwnership(
      ctx,
      teamId,
      userId,
      subtask.brainstormId,
    );

    const sanitizedDependencies = Array.from(
      new Set(
        args.dependsOn.filter(
          (id) => id !== args.subtaskId,
        ),
      ),
    );

    const dependencyRecords = await ctx.db
      .query("taskBrainstormDependencies")
      .withIndex("by_subtask", (q) => q.eq("subtaskId", args.subtaskId))
      .collect();

    for (const dependency of dependencyRecords) {
      await ctx.db.delete(dependency._id);
    }

    const now = Date.now();
    for (const dependencyId of sanitizedDependencies) {
      const dependencySubtask = await ctx.db.get(dependencyId);
      if (!dependencySubtask || dependencySubtask.brainstormId !== subtask.brainstormId) {
        continue;
      }
      await ctx.db.insert("taskBrainstormDependencies", {
        brainstormId: subtask.brainstormId,
        teamId,
        subtaskId: args.subtaskId,
        dependsOnSubtaskId: dependencyId,
        createdAt: now,
      });
    }

    await ctx.db.patch(subtask.brainstormId, { updatedAt: now });
    await ctx.db.patch(brainstorm.taskId, { updatedAt: now });
  },
});

export const reorderSubtasks = authMutation({
  args: {
    teamSlugOrId: v.string(),
    brainstormId: v.id("taskBrainstorms"),
    sequence: v.array(
      v.object({
        subtaskId: v.id("taskBrainstormSubtasks"),
        sequence: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const identity = ctx.identity;
    const userId = identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    const brainstorm = await ensureBrainstormOwnership(
      ctx,
      teamId,
      userId,
      args.brainstormId,
    );

    const targetSequence = new Map<Id<"taskBrainstormSubtasks">, number>();
    for (const entry of args.sequence) {
      targetSequence.set(entry.subtaskId, entry.sequence);
    }

    const subtasks = await ctx.db
      .query("taskBrainstormSubtasks")
      .withIndex("by_brainstorm", (q) => q.eq("brainstormId", args.brainstormId))
      .collect();

    const now = Date.now();
    for (const subtask of subtasks) {
      const nextSequence = targetSequence.get(subtask._id);
      if (nextSequence === undefined || nextSequence === subtask.sequence) {
        continue;
      }
      await ctx.db.patch(subtask._id, {
        sequence: nextSequence,
        updatedAt: now,
      });
    }

    await ctx.db.patch(args.brainstormId, { updatedAt: now });
    await ctx.db.patch(brainstorm.taskId, { updatedAt: now });
  },
});
