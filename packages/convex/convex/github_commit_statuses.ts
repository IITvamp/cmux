import { v } from "convex/values";
import { getTeamId } from "../_shared/team";
import { internalMutation } from "./_generated/server";
import { authQuery } from "./users/utils";

const timestampValue = v.union(v.string(), v.number());

export type StatusWebhookPayload = {
  id?: number;
  sha?: string;
  context?: string;
  state?: string;
  repositoryId?: number;
  description?: string;
  targetUrl?: string;
  senderLogin?: string;
  createdAt?: string | number;
  updatedAt?: string | number;
};

function normalizeTimestamp(
  value: string | number | null | undefined,
): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") {
    return value > 1000000000000 ? value : value * 1000;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export const upsertCommitStatusFromWebhook = internalMutation({
  args: {
    installationId: v.number(),
    repoFullName: v.string(),
    teamId: v.string(),
    payload: v.object({
      id: v.optional(v.number()),
      sha: v.optional(v.string()),
      context: v.optional(v.string()),
      state: v.optional(v.string()),
      repositoryId: v.optional(v.number()),
      description: v.optional(v.string()),
      targetUrl: v.optional(v.string()),
      senderLogin: v.optional(v.string()),
      createdAt: v.optional(timestampValue),
      updatedAt: v.optional(timestampValue),
    }),
  },
  handler: async (ctx, args) => {
    const { installationId, repoFullName, teamId, payload } = args;


    const statusId = payload.id;
    const sha = payload.sha;
    const context = payload.context;

    if (!statusId || !sha || !context) {
      console.warn("[upsertCommitStatus] Missing required fields", {
        statusId,
        sha,
        context,
        repoFullName,
        teamId,
      });
      return;
    }

    const validStates = ["error", "failure", "pending", "success"] as const;
    type ValidState = typeof validStates[number];
    const state = validStates.includes(payload.state as ValidState)
      ? payload.state
      : "pending";

    const createdAt = normalizeTimestamp(payload.createdAt);
    const updatedAt = normalizeTimestamp(payload.updatedAt);

    const statusDoc = {
      provider: "github" as const,
      installationId,
      repositoryId: payload.repositoryId,
      repoFullName,
      statusId,
      teamId,
      sha,
      state,
      context,
      description: payload.description ?? undefined,
      targetUrl: payload.targetUrl ?? undefined,
      creatorLogin: payload.senderLogin,
      createdAt,
      updatedAt,
      triggeringPrNumber: undefined,
    };


    const existingRecords = await ctx.db
      .query("githubCommitStatuses")
      .withIndex("by_statusId", (q) => q.eq("statusId", statusId))
      .collect();

    if (existingRecords.length > 0) {
      await ctx.db.patch(existingRecords[0]._id, statusDoc);

      if (existingRecords.length > 1) {
        console.warn("[upsertCommitStatus] Found duplicates, cleaning up", {
          statusId,
          count: existingRecords.length,
          duplicateIds: existingRecords.slice(1).map(r => r._id),
        });
        for (const duplicate of existingRecords.slice(1)) {
          await ctx.db.delete(duplicate._id);
        }
      }
    } else {
      await ctx.db.insert("githubCommitStatuses", statusDoc);
    }
  },
});

export const getCommitStatusesForPr = authQuery({
  args: {
    teamSlugOrId: v.string(),
    repoFullName: v.string(),
    prNumber: v.number(),
    headSha: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { teamSlugOrId, repoFullName, headSha, limit = 20 } = args;
    const teamId = await getTeamId(ctx, teamSlugOrId);


    if (!headSha) {
      return [];
    }

    const allStatuses = await ctx.db
      .query("githubCommitStatuses")
      .withIndex("by_sha", (q) => q.eq("sha", headSha))
      .filter((q) =>
        q.and(
          q.eq(q.field("teamId"), teamId),
          q.eq(q.field("repoFullName"), repoFullName),
        ),
      )
      .order("desc")
      .collect();

    // Deduplicate by context (status name), keeping the most recently updated one
    const dedupMap = new Map<string, typeof allStatuses[number]>();
    for (const status of allStatuses) {
      const existing = dedupMap.get(status.context);
      if (!existing || (status.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
        dedupMap.set(status.context, status);
      }
    }
    const statuses = Array.from(dedupMap.values()).slice(0, limit);


    return statuses;
  },
});
