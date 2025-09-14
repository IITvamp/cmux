import { v } from "convex/values";
import { getTeamId } from "../_shared/team";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { authQuery } from "./users/utils";

type NormalizedCheck = {
  provider: "github";
  installationId: number;
  teamId: string;
  repoFullName: string;
  sha: string;
  branch?: string;
  checkType: "check_run" | "status" | "workflow_run" | "workflow_job";
  name: string;
  status?: "queued" | "in_progress" | "completed" | "pending";
  conclusion?:
    | "success"
    | "failure"
    | "neutral"
    | "cancelled"
    | "timed_out"
    | "action_required"
    | "skipped"
    | "stale"
    | "error";
  detailsUrl?: string;
  externalId?: string;
  startedAt?: number;
  completedAt?: number;
};

async function upsertCore(ctx: MutationCtx, input: NormalizedCheck) {
  const now = Date.now();
  // Upsert by unique key: installationId + repoFullName + sha + name
  const existing = await ctx.db
    .query("commitChecks")
    .withIndex("by_repo_sha", (q) =>
      q.eq("repoFullName", input.repoFullName).eq("sha", input.sha)
    )
    .filter((q) => q.eq(q.field("name"), input.name))
    .first();
  if (existing) {
    await ctx.db.patch(existing._id, {
      teamId: input.teamId,
      installationId: input.installationId,
      branch: input.branch,
      checkType: input.checkType,
      name: input.name,
      status: input.status,
      conclusion: input.conclusion,
      detailsUrl: input.detailsUrl,
      externalId: input.externalId,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      updatedAt: now,
    });
    return existing._id;
  }
  const id = await ctx.db.insert("commitChecks", {
    provider: "github",
    installationId: input.installationId,
    teamId: input.teamId,
    repoFullName: input.repoFullName,
    sha: input.sha,
    branch: input.branch,
    checkType: input.checkType,
    name: input.name,
    status: input.status,
    conclusion: input.conclusion,
    detailsUrl: input.detailsUrl,
    externalId: input.externalId,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

// Internal upsert from webhook-normalized payloads
export const upsertFromWebhook = internalMutation({
  args: {
    installationId: v.number(),
    teamId: v.string(),
    repoFullName: v.string(),
    sha: v.string(),
    branch: v.optional(v.string()),
    checkType: v.union(
      v.literal("check_run"),
      v.literal("status"),
      v.literal("workflow_run"),
      v.literal("workflow_job")
    ),
    name: v.string(),
    status: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("pending")
      )
    ),
    conclusion: v.optional(
      v.union(
        v.literal("success"),
        v.literal("failure"),
        v.literal("neutral"),
        v.literal("cancelled"),
        v.literal("timed_out"),
        v.literal("action_required"),
        v.literal("skipped"),
        v.literal("stale"),
        v.literal("error")
      )
    ),
    detailsUrl: v.optional(v.string()),
    externalId: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) =>
    upsertCore(ctx, {
      provider: "github",
      installationId: args.installationId,
      teamId: args.teamId,
      repoFullName: args.repoFullName,
      sha: args.sha,
      branch: args.branch,
      checkType: args.checkType,
      name: args.name,
      status: args.status,
      conclusion: args.conclusion,
      detailsUrl: args.detailsUrl,
      externalId: args.externalId,
      startedAt: args.startedAt,
      completedAt: args.completedAt,
    }),
});

// Public query: list checks for a given repo + sha within a team
export const listByRepoAndSha = authQuery({
  args: {
    teamSlugOrId: v.string(),
    repoFullName: v.string(),
    sha: v.string(),
  },
  handler: async (ctx, { teamSlugOrId, repoFullName, sha }) => {
    const teamId = await getTeamId(ctx, teamSlugOrId);
    const rows = await ctx.db
      .query("commitChecks")
      .withIndex("by_team_repo_sha", (q) =>
        q.eq("teamId", teamId).eq("repoFullName", repoFullName).eq("sha", sha)
      )
      .collect();
    // Sort: completed first (by completedAt desc), then in_progress/pending
    return rows.sort((a, b) => {
      const ac = a.completedAt || 0;
      const bc = b.completedAt || 0;
      const aDone = a.status === "completed" || !!a.conclusion;
      const bDone = b.status === "completed" || !!b.conclusion;
      if (aDone && bDone) return bc - ac;
      if (aDone) return -1;
      if (bDone) return 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  },
});

// Internal helper: list by PR (teamId, repo, number) using stored PR headSha
export const listByPullRequestInternal = internalQuery({
  args: { teamId: v.string(), repoFullName: v.string(), number: v.number() },
  handler: async (ctx, { teamId, repoFullName, number }) => {
    const pr = await ctx.db
      .query("pullRequests")
      .withIndex("by_team_repo_number", (q) =>
        q.eq("teamId", teamId).eq("repoFullName", repoFullName).eq("number", number)
      )
      .first();
    if (!pr?.headSha) return [] as const;
    const rows = await ctx.db
      .query("commitChecks")
      .withIndex("by_team_repo_sha", (q) =>
        q.eq("teamId", teamId).eq("repoFullName", repoFullName).eq("sha", pr.headSha as string)
      )
      .collect();
    return rows;
  },
});

