import { v } from "convex/values";
import { authMutation, authQuery } from "./users/utils";
import { getTeamId } from "../_shared/team";

export const list = authQuery({
  args: { teamSlugOrId: v.string() },
  handler: async (ctx, { teamSlugOrId }) => {
    const teamId = await getTeamId(ctx, teamSlugOrId);
    const rows = await ctx.db
      .query("environments")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .order("desc")
      .collect();
    return rows.map((r) => ({
      _id: r._id,
      name: r.name,
      morphSnapshotId: r.morphSnapshotId,
      teamId: r.teamId,
      createdByUserId: r.createdByUserId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  },
});

export const create = authMutation({
  args: {
    teamSlugOrId: v.string(),
    name: v.string(),
    morphSnapshotId: v.string(),
    dataVaultKey: v.string(),
  },
  handler: async (ctx, { teamSlugOrId, name, morphSnapshotId, dataVaultKey }) => {
    const userId = ctx.identity.subject;
    const teamId = await getTeamId(ctx, teamSlugOrId);
    const now = Date.now();

    const id = await ctx.db.insert("environments", {
      name,
      morphSnapshotId,
      dataVaultKey,
      teamId,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

