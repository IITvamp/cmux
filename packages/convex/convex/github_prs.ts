import { v } from "convex/values";
import { getTeamId } from "../_shared/team";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { authMutation, authQuery } from "./users/utils";

const SYSTEM_BRANCH_USER_ID = "__system__";

export type PullRequestWebhookPayload = {
  number?: number;
  providerPrId?: number;
  repositoryId?: number;
  title?: string;
  state?: string;
  merged?: boolean;
  draft?: boolean;
  htmlUrl?: string;
  authorLogin?: string;
  authorId?: number;
  baseRef?: string;
  headRef?: string;
  baseSha?: string;
  headSha?: string;
  mergeCommitSha?: string;
  createdAt?: string;
  updatedAt?: string;
  closedAt?: string;
  mergedAt?: string;
  commentsCount?: number;
  reviewCommentsCount?: number;
  commitsCount?: number;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
  baseRepoPushedAt?: string;
};

async function upsertBranchMetadata(
  ctx: MutationCtx,
  {
    teamId,
    repoFullName,
    branchName,
    baseSha,
    mergeCommitSha,
    headSha,
    activityTimestamp,
  }: {
    teamId: string;
    repoFullName: string;
    branchName: string;
    baseSha?: string;
    mergeCommitSha?: string;
    headSha?: string;
    activityTimestamp?: number;
  }
) {
  if (!baseSha && !mergeCommitSha && !headSha) {
    return;
  }

  const repoDoc = await ctx.db
    .query("repos")
    .withIndex("by_team", (q) => q.eq("teamId", teamId))
    .filter((q) => q.eq(q.field("fullName"), repoFullName))
    .first();
  const repoId = repoDoc?._id;

  const rows = await ctx.db
    .query("branches")
    .withIndex("by_repo", (q) => q.eq("repo", repoFullName))
    .filter((q) => q.eq(q.field("teamId"), teamId))
    .filter((q) => q.eq(q.field("name"), branchName))
    .collect();

  const timestamp = activityTimestamp ?? Date.now();

  for (const row of rows) {
    const patch: Record<string, unknown> = {};
    if (repoId && row.repoId !== repoId) {
      patch.repoId = repoId;
    }
    if (baseSha && row.lastKnownBaseSha !== baseSha) {
      patch.lastKnownBaseSha = baseSha;
    }
    if (
      mergeCommitSha &&
      row.lastKnownMergeCommitSha !== mergeCommitSha
    ) {
      patch.lastKnownMergeCommitSha = mergeCommitSha;
    }
    if (headSha && row.lastCommitSha !== headSha) {
      patch.lastCommitSha = headSha;
    }
    if (
      typeof row.lastActivityAt !== "number" ||
      timestamp > row.lastActivityAt
    ) {
      patch.lastActivityAt = timestamp;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(row._id, patch);
    }
  }

  const hasSystemRow = rows.some((row) => row.userId === SYSTEM_BRANCH_USER_ID);
  if (!hasSystemRow) {
    await ctx.db.insert("branches", {
      repo: repoFullName,
      repoId,
      name: branchName,
      userId: SYSTEM_BRANCH_USER_ID,
      teamId,
      lastKnownBaseSha: baseSha,
      lastKnownMergeCommitSha: mergeCommitSha,
      lastCommitSha: headSha,
      lastActivityAt: timestamp,
    });
  }
}

async function upsertCore(
  ctx: MutationCtx,
  {
    teamId,
    installationId,
    repoFullName,
    number,
    record,
  }: {
    teamId: string;
    installationId: number;
    repoFullName: string;
    number: number;
    record: {
      providerPrId?: number;
      repositoryId?: number;
      title: string;
      state: "open" | "closed";
      merged?: boolean;
      draft?: boolean;
      authorLogin?: string;
      authorId?: number;
      htmlUrl?: string;
      baseRef?: string;
      headRef?: string;
      baseSha?: string;
      headSha?: string;
      mergeCommitSha?: string;
      createdAt?: number;
      updatedAt?: number;
      closedAt?: number;
      mergedAt?: number;
      commentsCount?: number;
      reviewCommentsCount?: number;
      commitsCount?: number;
      additions?: number;
      deletions?: number;
      changedFiles?: number;
    };
  }
) {
  const existing = await ctx.db
    .query("pullRequests")
    .withIndex("by_team_repo_number", (q) =>
      q.eq("teamId", teamId).eq("repoFullName", repoFullName).eq("number", number)
    )
    .first();
  if (existing) {
    await ctx.db.patch(existing._id, {
      ...record,
      installationId,
      repoFullName,
      number,
      provider: "github",
      teamId,
    });
    return existing._id;
  }
  const id = await ctx.db.insert("pullRequests", {
    provider: "github",
    teamId,
    installationId,
    repoFullName,
    number,
    ...record,
  });
  return id;
}

export const upsertPullRequestInternal = internalMutation({
  args: {
    teamId: v.string(),
    installationId: v.number(),
    repoFullName: v.string(),
    number: v.number(),
    record: v.object({
      providerPrId: v.optional(v.number()),
      repositoryId: v.optional(v.number()),
      title: v.string(),
      state: v.union(v.literal("open"), v.literal("closed")),
      merged: v.optional(v.boolean()),
      draft: v.optional(v.boolean()),
      authorLogin: v.optional(v.string()),
      authorId: v.optional(v.number()),
      htmlUrl: v.optional(v.string()),
      baseRef: v.optional(v.string()),
      headRef: v.optional(v.string()),
      baseSha: v.optional(v.string()),
      headSha: v.optional(v.string()),
      mergeCommitSha: v.optional(v.string()),
      createdAt: v.optional(v.number()),
      updatedAt: v.optional(v.number()),
      closedAt: v.optional(v.number()),
      mergedAt: v.optional(v.number()),
      commentsCount: v.optional(v.number()),
      reviewCommentsCount: v.optional(v.number()),
      commitsCount: v.optional(v.number()),
      additions: v.optional(v.number()),
      deletions: v.optional(v.number()),
      changedFiles: v.optional(v.number()),
    }),
  },
  handler: async (ctx, { teamId, installationId, repoFullName, number, record }) =>
    upsertCore(ctx, { teamId, installationId, repoFullName, number, record }),
});

export const listPullRequests = authQuery({
  args: {
    teamSlugOrId: v.string(),
    state: v.optional(v.union(v.literal("open"), v.literal("closed"), v.literal("all"))),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { teamSlugOrId, state, search, limit }) => {
    const teamId = await getTeamId(ctx, teamSlugOrId);

    const useState = state ?? "open";
    const cursor = ctx.db
      .query("pullRequests")
      .withIndex(
        useState === "all" ? "by_team" : "by_team_state",
        (q) =>
          useState === "all"
            ? q.eq("teamId", teamId)
            : q.eq("teamId", teamId).eq("state", useState)
      )
      .order("desc");

    const rows = await cursor.collect();
    const q = (search ?? "").trim().toLowerCase();
    const filtered = !q
      ? rows
      : rows.filter((r) => {
          return (
            r.title.toLowerCase().includes(q) ||
            (r.authorLogin ?? "").toLowerCase().includes(q) ||
            r.repoFullName.toLowerCase().includes(q)
          );
        });
    const limited = typeof limit === "number" ? filtered.slice(0, Math.max(1, limit)) : filtered;
    return limited;
  },
});

export const getPullRequest = authQuery({
  args: {
    teamSlugOrId: v.string(),
    repoFullName: v.string(),
    number: v.number(),
  },
  handler: async (ctx, { teamSlugOrId, repoFullName, number }) => {
    const teamId = await getTeamId(ctx, teamSlugOrId);

    const pr = await ctx.db
      .query("pullRequests")
      .withIndex("by_team_repo_number", (q) =>
        q.eq("teamId", teamId).eq("repoFullName", repoFullName).eq("number", number)
      )
      .first();

    return pr ?? null;
  },
});

// Helper to look up a provider connection for a repository owner
export const getConnectionForOwnerInternal = internalQuery({
  args: { owner: v.string() },
  handler: async (ctx, { owner }) => {
    // If the same owner has multiple installations, this returns one arbitrarily.
    const row = await ctx.db
      .query("providerConnections")
      .filter((q) => q.eq(q.field("accountLogin"), owner))
      .first();
    return row ?? null;
  },
});

export const upsertFromWebhookPayload = internalMutation({
  args: {
    installationId: v.number(),
    repoFullName: v.string(),
    teamId: v.string(),
    payload: v.object({
      number: v.optional(v.number()),
      providerPrId: v.optional(v.number()),
      repositoryId: v.optional(v.number()),
      title: v.optional(v.string()),
      state: v.optional(v.string()),
      merged: v.optional(v.boolean()),
      draft: v.optional(v.boolean()),
      htmlUrl: v.optional(v.string()),
      authorLogin: v.optional(v.string()),
      authorId: v.optional(v.number()),
      baseRef: v.optional(v.string()),
      headRef: v.optional(v.string()),
      baseSha: v.optional(v.string()),
      headSha: v.optional(v.string()),
      mergeCommitSha: v.optional(v.string()),
      createdAt: v.optional(v.string()),
      updatedAt: v.optional(v.string()),
      closedAt: v.optional(v.string()),
      mergedAt: v.optional(v.string()),
      commentsCount: v.optional(v.number()),
      reviewCommentsCount: v.optional(v.number()),
      commitsCount: v.optional(v.number()),
      additions: v.optional(v.number()),
      deletions: v.optional(v.number()),
      changedFiles: v.optional(v.number()),
      baseRepoPushedAt: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { installationId, repoFullName, teamId, payload }) => {
    try {
      const number = payload.number ?? 0;
      if (!number) return { ok: false as const };
      const ts = (s: unknown) => {
        if (typeof s !== "string") return undefined;
        const n = Date.parse(s);
        return Number.isFinite(n) ? n : undefined;
      };
      const baseRef = payload.baseRef;
      const headRef = payload.headRef;
      const baseSha = payload.baseSha;
      const headSha = payload.headSha;
      const mergeCommitSha = payload.mergeCommitSha;
      const baseActivityTs =
        ts(payload.baseRepoPushedAt) ??
        ts(payload.mergedAt) ??
        ts(payload.updatedAt) ??
        Date.now();

      await upsertCore(ctx, {
        teamId,
        installationId,
        repoFullName,
        number,
        record: {
          providerPrId: payload.providerPrId,
          repositoryId: payload.repositoryId,
          title: payload.title ?? "",
          state: payload.state === "closed" ? "closed" : "open",
          merged: Boolean(payload.merged),
          draft: Boolean(payload.draft),
          authorLogin: payload.authorLogin,
          authorId: payload.authorId,
          htmlUrl: payload.htmlUrl,
          baseRef,
          headRef,
          baseSha,
          headSha,
          mergeCommitSha,
          createdAt: ts(payload.createdAt),
          updatedAt: ts(payload.updatedAt),
          closedAt: ts(payload.closedAt),
          mergedAt: ts(payload.mergedAt),
          commentsCount: payload.commentsCount,
          reviewCommentsCount: payload.reviewCommentsCount,
          commitsCount: payload.commitsCount,
          additions: payload.additions,
          deletions: payload.deletions,
          changedFiles: payload.changedFiles,
        },
      });

      if (baseRef && (baseSha || mergeCommitSha)) {
        await upsertBranchMetadata(ctx, {
          teamId,
          repoFullName,
          branchName: baseRef,
          baseSha,
          mergeCommitSha,
          activityTimestamp: baseActivityTs,
        });
      }
      if (headRef && headSha) {
        await upsertBranchMetadata(ctx, {
          teamId,
          repoFullName,
          branchName: headRef,
          headSha,
          activityTimestamp: ts(payload.updatedAt) ?? Date.now(),
        });
      }
      return { ok: true as const };
    } catch (_e) {
      return { ok: false as const };
    }
  },
});

export const upsertFromServer = authMutation({
  args: {
    teamSlugOrId: v.string(),
    installationId: v.number(),
    repoFullName: v.string(),
    number: v.number(),
    record: v.object({
      providerPrId: v.optional(v.number()),
      repositoryId: v.optional(v.number()),
      title: v.string(),
      state: v.union(v.literal("open"), v.literal("closed")),
      merged: v.optional(v.boolean()),
      draft: v.optional(v.boolean()),
      authorLogin: v.optional(v.string()),
      authorId: v.optional(v.number()),
      htmlUrl: v.optional(v.string()),
      baseRef: v.optional(v.string()),
      headRef: v.optional(v.string()),
      baseSha: v.optional(v.string()),
      headSha: v.optional(v.string()),
      mergeCommitSha: v.optional(v.string()),
      createdAt: v.optional(v.number()),
      updatedAt: v.optional(v.number()),
      closedAt: v.optional(v.number()),
      mergedAt: v.optional(v.number()),
      commentsCount: v.optional(v.number()),
      reviewCommentsCount: v.optional(v.number()),
      commitsCount: v.optional(v.number()),
      additions: v.optional(v.number()),
      deletions: v.optional(v.number()),
      changedFiles: v.optional(v.number()),
    }),
  },
  handler: async (ctx, { teamSlugOrId, installationId, repoFullName, number, record }) => {
    const teamId = await getTeamId(ctx, teamSlugOrId);
    return await upsertCore(ctx, { teamId, installationId, repoFullName, number, record });
  },
});
