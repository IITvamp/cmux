import { v } from "convex/values";
import { resolveTeamIdLoose } from "../_shared/team";
import { stackServerAppJs } from "../_shared/stackServerAppJs";
import { authMutation, authQuery } from "./users/utils";

export const list = authQuery({
  args: {
    teamSlugOrId: v.string(),
    environmentId: v.id("environments"),
  },
  handler: async (ctx, args) => {
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);
    const environment = await ctx.db.get(args.environmentId);
    if (!environment || environment.teamId !== teamId) {
      throw new Error("Environment not found");
    }

    const versions = await ctx.db
      .query("environmentSnapshotVersions")
      .withIndex("by_environment_version", (q) =>
        q.eq("environmentId", args.environmentId)
      )
      .order("desc")
      .collect();

    // Fetch user data for each unique createdByUserId
    const userIds = [...new Set(versions.map(v => v.createdByUserId))];
    const userPromises = userIds.map(async (userId) => {
      try {
        const user = await stackServerAppJs.getUser(userId);
        return { userId, displayName: user?.displayName || userId };
      } catch (error) {
        console.error(`Failed to fetch user ${userId}:`, error);
        return { userId, displayName: userId };
      }
    });
    const users = await Promise.all(userPromises);
    const userMap = new Map(users.map(u => [u.userId, u.displayName]));

    return versions.map((version) => ({
      ...version,
      isActive: version.morphSnapshotId === environment.morphSnapshotId,
      createdByUserName: userMap.get(version.createdByUserId) || version.createdByUserId,
    }));
  },
});

export const create = authMutation({
  args: {
    teamSlugOrId: v.string(),
    environmentId: v.id("environments"),
    morphSnapshotId: v.string(),
    label: v.optional(v.string()),
    activate: v.optional(v.boolean()),
    maintenanceScript: v.optional(v.string()),
    devScript: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);
    const environment = await ctx.db.get(args.environmentId);
    if (!environment || environment.teamId !== teamId) {
      throw new Error("Environment not found");
    }
    const userId = ctx.identity.subject;
    if (!userId) {
      throw new Error("Authentication required");
    }

    const latest = await ctx.db
      .query("environmentSnapshotVersions")
      .withIndex("by_environment_version", (q) =>
        q.eq("environmentId", args.environmentId)
      )
      .order("desc")
      .first();

    const nextVersion = (latest?.version ?? 0) + 1;
    const createdAt = Date.now();
    const maintenanceScript =
      args.maintenanceScript ?? environment.maintenanceScript ?? undefined;
    const devScript = args.devScript ?? environment.devScript ?? undefined;

    const snapshotVersionId = await ctx.db.insert(
      "environmentSnapshotVersions",
      {
        environmentId: args.environmentId,
        teamId,
        morphSnapshotId: args.morphSnapshotId,
        version: nextVersion,
        createdAt,
        createdByUserId: userId,
        label: args.label,
        maintenanceScript,
        devScript,
      }
    );

    if (args.activate ?? true) {
      await ctx.db.patch(args.environmentId, {
        morphSnapshotId: args.morphSnapshotId,
        maintenanceScript,
        devScript,
        updatedAt: Date.now(),
      });
    }

    return {
      snapshotVersionId,
      version: nextVersion,
    };
  },
});

export const activate = authMutation({
  args: {
    teamSlugOrId: v.string(),
    environmentId: v.id("environments"),
    snapshotVersionId: v.id("environmentSnapshotVersions"),
  },
  handler: async (ctx, args) => {
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);
    const environment = await ctx.db.get(args.environmentId);
    if (!environment || environment.teamId !== teamId) {
      throw new Error("Environment not found");
    }

    const versionDoc = await ctx.db.get(args.snapshotVersionId);
    if (
      !versionDoc ||
      versionDoc.environmentId !== args.environmentId ||
      versionDoc.teamId !== teamId
    ) {
      throw new Error("Snapshot version not found");
    }

    const maintenanceScript =
      versionDoc.maintenanceScript ?? environment.maintenanceScript ?? undefined;
    const devScript =
      versionDoc.devScript ?? environment.devScript ?? undefined;

    await ctx.db.patch(args.environmentId, {
      morphSnapshotId: versionDoc.morphSnapshotId,
      maintenanceScript,
      devScript,
      updatedAt: Date.now(),
    });

    return {
      morphSnapshotId: versionDoc.morphSnapshotId,
      version: versionDoc.version,
    };
  },
});

export const remove = authMutation({
  args: {
    teamSlugOrId: v.string(),
    environmentId: v.id("environments"),
    snapshotVersionId: v.id("environmentSnapshotVersions"),
  },
  handler: async (ctx, args) => {
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);
    const environment = await ctx.db.get(args.environmentId);

    if (!environment || environment.teamId !== teamId) {
      throw new Error("Environment not found");
    }

    const versionDoc = await ctx.db.get(args.snapshotVersionId);

    if (
      !versionDoc ||
      versionDoc.environmentId !== args.environmentId ||
      versionDoc.teamId !== teamId
    ) {
      throw new Error("Snapshot version not found");
    }

    if (versionDoc.morphSnapshotId === environment.morphSnapshotId) {
      throw new Error("Cannot delete the active snapshot version.");
    }

    await ctx.db.delete(args.snapshotVersionId);
  },
});

export const findBySnapshotId = authQuery({
  args: {
    teamSlugOrId: v.string(),
    snapshotId: v.string(),
  },
  handler: async (ctx, args) => {
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);

    return await ctx.db
      .query("environmentSnapshotVersions")
      .withIndex("by_team_snapshot", (q) =>
        q.eq("teamId", teamId).eq("morphSnapshotId", args.snapshotId)
      )
      .first();
  },
});
