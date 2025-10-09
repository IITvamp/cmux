import { v } from "convex/values";
import { getTeamId } from "../_shared/team";
import { internalMutation } from "./_generated/server";
import { authQuery } from "./users/utils";
import type { StatusEvent } from "@octokit/webhooks-types";

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
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const payload = args.payload as StatusEvent;
    const { installationId, repoFullName, teamId } = args;

    console.log("[upsertCommitStatus] Starting", {
      teamId,
      repoFullName,
      installationId,
      state: payload.state,
      context: payload.context,
    });

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

    const createdAt = normalizeTimestamp(payload.created_at);
    const updatedAt = normalizeTimestamp(payload.updated_at);

    const statusDoc = {
      provider: "github" as const,
      installationId,
      repositoryId: payload.repository?.id,
      repoFullName,
      statusId,
      teamId,
      sha,
      state,
      context,
      description: payload.description ?? undefined,
      targetUrl: payload.target_url ?? undefined,
      creatorLogin: payload.sender?.login,
      createdAt,
      updatedAt,
      triggeringPrNumber: undefined,
    };

    console.log("[upsertCommitStatus] Prepared document", {
      statusId,
      sha,
      context,
      state,
      teamId,
      repoFullName,
    });

    const existing = await ctx.db
      .query("githubCommitStatuses")
      .withIndex("by_statusId", (q) => q.eq("statusId", statusId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, statusDoc);
      console.log("[upsertCommitStatus] Updated commit status", {
        _id: existing._id,
        statusId,
        context,
        state,
        repoFullName,
      });
    } else {
      const newId = await ctx.db.insert("githubCommitStatuses", statusDoc);
      console.log("[upsertCommitStatus] Inserted commit status", {
        _id: newId,
        statusId,
        context,
        state,
        repoFullName,
      });
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

    console.log("[getCommitStatusesForPr] Query started", {
      teamSlugOrId,
      teamId,
      repoFullName,
      headSha,
      limit,
    });

    if (!headSha) {
      console.log("[getCommitStatusesForPr] No headSha provided, returning empty array");
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

    console.log("[getCommitStatusesForPr] Found commit statuses", {
      teamId,
      repoFullName,
      headSha,
      foundStatuses: statuses.length,
      contexts: statuses.map((s) => s.context),
    });

    return statuses;
  },
});
