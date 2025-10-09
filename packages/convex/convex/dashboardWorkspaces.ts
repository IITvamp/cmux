import { v } from "convex/values";
import { resolveTeamIdLoose } from "../_shared/team";
import { authMutation, authQuery } from "./users/utils";

export const get = authQuery({
  args: { teamSlugOrId: v.string() },
  handler: async (ctx, args) => {
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);
    const workspace = await ctx.db
      .query("dashboardWorkspaces")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .first();
    return workspace;
  },
});

export const upsert = authMutation({
  args: {
    teamSlugOrId: v.string(),
    provider: v.union(
      v.literal("docker"),
      v.literal("morph"),
      v.literal("daytona")
    ),
    status: v.union(
      v.literal("starting"),
      v.literal("running"),
      v.literal("stopped")
    ),
    containerName: v.optional(v.string()),
    instanceId: v.optional(v.string()),
    vscodeUrl: v.optional(v.string()),
    workerUrl: v.optional(v.string()),
    workspaceUrl: v.optional(v.string()),
    volumePath: v.optional(v.string()),
    currentRepoName: v.optional(v.string()),
    ports: v.optional(
      v.object({
        vscode: v.string(),
        worker: v.string(),
        extension: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);
    const now = Date.now();

    const existing = await ctx.db
      .query("dashboardWorkspaces")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        provider: args.provider,
        status: args.status,
        containerName: args.containerName,
        instanceId: args.instanceId,
        vscodeUrl: args.vscodeUrl,
        workerUrl: args.workerUrl,
        workspaceUrl: args.workspaceUrl,
        volumePath: args.volumePath,
        currentRepoName: args.currentRepoName,
        ports: args.ports,
        updatedAt: now,
        ...(args.status === "running" && { startedAt: now }),
        ...(args.status === "stopped" && { stoppedAt: now }),
      });
      return existing._id;
    }

    return await ctx.db.insert("dashboardWorkspaces", {
      teamId,
      provider: args.provider,
      status: args.status,
      containerName: args.containerName,
      instanceId: args.instanceId,
      vscodeUrl: args.vscodeUrl,
      workerUrl: args.workerUrl,
      workspaceUrl: args.workspaceUrl,
      volumePath: args.volumePath,
      currentRepoName: args.currentRepoName,
      ports: args.ports,
      createdAt: now,
      updatedAt: now,
      ...(args.status === "running" && { startedAt: now }),
    });
  },
});

export const updateStatus = authMutation({
  args: {
    teamSlugOrId: v.string(),
    status: v.union(
      v.literal("starting"),
      v.literal("running"),
      v.literal("stopped")
    ),
  },
  handler: async (ctx, args) => {
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);
    const workspace = await ctx.db
      .query("dashboardWorkspaces")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .first();

    if (!workspace) {
      throw new Error("Dashboard workspace not found");
    }

    const now = Date.now();
    await ctx.db.patch(workspace._id, {
      status: args.status,
      updatedAt: now,
      ...(args.status === "running" && { startedAt: now }),
      ...(args.status === "stopped" && { stoppedAt: now }),
    });
  },
});

export const updateCurrentRepo = authMutation({
  args: {
    teamSlugOrId: v.string(),
    repoFullName: v.string(),
  },
  handler: async (ctx, args) => {
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);
    const workspace = await ctx.db
      .query("dashboardWorkspaces")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .first();

    if (!workspace) {
      throw new Error("Dashboard workspace not found");
    }

    await ctx.db.patch(workspace._id, {
      currentRepoName: args.repoFullName,
      updatedAt: Date.now(),
      lastAccessedAt: Date.now(),
    });
  },
});

export const updatePorts = authMutation({
  args: {
    teamSlugOrId: v.string(),
    ports: v.object({
      vscode: v.string(),
      worker: v.string(),
      extension: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);
    const workspace = await ctx.db
      .query("dashboardWorkspaces")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .first();

    if (!workspace) {
      throw new Error("Dashboard workspace not found");
    }

    await ctx.db.patch(workspace._id, {
      ports: args.ports,
      updatedAt: Date.now(),
    });
  },
});

export const remove = authMutation({
  args: { teamSlugOrId: v.string() },
  handler: async (ctx, args) => {
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);
    const workspace = await ctx.db
      .query("dashboardWorkspaces")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .first();

    if (workspace) {
      await ctx.db.delete(workspace._id);
    }
  },
});
