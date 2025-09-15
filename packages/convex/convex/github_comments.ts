import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";

function mapStr(vv: unknown): string | undefined {
  return typeof vv === "string" ? vv : undefined;
}
function mapNum(vv: unknown): number | undefined {
  return typeof vv === "number" ? vv : undefined;
}
function ts(vv: unknown): number | undefined {
  if (typeof vv !== "string") return undefined;
  const n = Date.parse(vv);
  return Number.isFinite(n) ? n : undefined;
}

async function upsertIssueComment(
  ctx: MutationCtx,
  args: { teamId: string; installationId: number; repoFullName: string; payload: any }
) {
  const payload = args.payload as Record<string, any>;
  const issue = (payload?.issue ?? {}) as Record<string, any>;
  const prFlag = issue.pull_request != null; // only keep PR comments
  if (!prFlag) return { ok: true as const };
  const number = Number(issue.number ?? payload?.number ?? 0);
  const comment = (payload?.comment ?? {}) as Record<string, any>;
  const commentId = Number(comment.id ?? 0);
  if (!number || !commentId) return { ok: false as const };

  const record = {
    teamId: args.teamId,
    installationId: args.installationId,
    repoFullName: args.repoFullName,
    repositoryId: mapNum(payload?.repository?.id),
    number,
    commentId,
    body: mapStr(comment.body) ?? "",
    authorLogin: mapStr(comment?.user?.login),
    authorId: mapNum(comment?.user?.id),
    htmlUrl: mapStr(comment.html_url),
    createdAt: ts(comment.created_at) ?? Date.now(),
    updatedAt: ts(comment.updated_at) ?? ts(comment.created_at) ?? Date.now(),
  } as const;

  // @ts-expect-error: New table will be in generated types after codegen
  const existing = await ctx.db
    .query("githubIssueComments")
    .withIndex("by_team_repo_pr", (q) =>
      q
        .eq("teamId", args.teamId)
        .eq("repoFullName", args.repoFullName)
        .eq("number", number)
        .eq("commentId", commentId)
    )
    .first();
  if (existing) {
    // @ts-expect-error: New table will be in generated types after codegen
    await ctx.db.patch(existing._id, record);
    return { ok: true as const };
  }
  // @ts-expect-error: New table will be in generated types after codegen
  await ctx.db.insert("githubIssueComments", record);
  return { ok: true as const };
}

async function upsertReview(
  ctx: MutationCtx,
  args: { teamId: string; installationId: number; repoFullName: string; payload: any }
) {
  const payload = args.payload as Record<string, any>;
  const pr = (payload?.pull_request ?? {}) as Record<string, any>;
  const number = Number(pr.number ?? payload?.number ?? 0);
  const review = (payload?.review ?? {}) as Record<string, any>;
  const reviewId = Number(review.id ?? 0);
  if (!number || !reviewId) return { ok: false as const };

  const record = {
    teamId: args.teamId,
    installationId: args.installationId,
    repoFullName: args.repoFullName,
    repositoryId: mapNum(payload?.repository?.id),
    number,
    reviewId,
    state: mapStr(review.state) ?? "commented",
    body: mapStr(review.body),
    authorLogin: mapStr(review?.user?.login),
    authorId: mapNum(review?.user?.id),
    commitId: mapStr(review.commit_id),
    htmlUrl: mapStr(review.html_url),
    submittedAt: ts(review.submitted_at) ?? ts(review.created_at),
  } as const;

  // @ts-expect-error: New table will be in generated types after codegen
  const existing = await ctx.db
    .query("githubPullRequestReviews")
    .withIndex("by_team_repo_pr", (q) =>
      q
        .eq("teamId", args.teamId)
        .eq("repoFullName", args.repoFullName)
        .eq("number", number)
        .eq("reviewId", reviewId)
    )
    .first();
  if (existing) {
    // @ts-expect-error: New table will be in generated types after codegen
    await ctx.db.patch(existing._id, record);
    return { ok: true as const };
  }
  // @ts-expect-error: New table will be in generated types after codegen
  await ctx.db.insert("githubPullRequestReviews", record);
  return { ok: true as const };
}

async function upsertReviewComment(
  ctx: MutationCtx,
  args: { teamId: string; installationId: number; repoFullName: string; payload: any }
) {
  const payload = args.payload as Record<string, any>;
  const pr = (payload?.pull_request ?? {}) as Record<string, any>;
  const number = Number(pr.number ?? payload?.number ?? 0);
  const comment = (payload?.comment ?? {}) as Record<string, any>;
  const commentId = Number(comment.id ?? 0);
  if (!number || !commentId) return { ok: false as const };

  const record = {
    teamId: args.teamId,
    installationId: args.installationId,
    repoFullName: args.repoFullName,
    repositoryId: mapNum(payload?.repository?.id),
    number,
    commentId,
    reviewId: mapNum(comment.pull_request_review_id),
    body: mapStr(comment.body) ?? "",
    authorLogin: mapStr(comment?.user?.login),
    authorId: mapNum(comment?.user?.id),
    path: mapStr(comment.path),
    diffHunk: mapStr(comment.diff_hunk),
    position: mapNum(comment.position),
    line: mapNum(comment.line),
    originalLine: mapNum(comment.original_line),
    side: mapStr(comment.side),
    htmlUrl: mapStr(comment.html_url),
    createdAt: ts(comment.created_at) ?? Date.now(),
    updatedAt: ts(comment.updated_at) ?? ts(comment.created_at) ?? Date.now(),
  } as const;

  // @ts-expect-error: New table will be in generated types after codegen
  const existing = await ctx.db
    .query("githubPullRequestReviewComments")
    .withIndex("by_team_repo_pr", (q) =>
      q
        .eq("teamId", args.teamId)
        .eq("repoFullName", args.repoFullName)
        .eq("number", number)
        .eq("commentId", commentId)
    )
    .first();
  if (existing) {
    // @ts-expect-error: New table will be in generated types after codegen
    await ctx.db.patch(existing._id, record);
    return { ok: true as const };
  }
  // @ts-expect-error: New table will be in generated types after codegen
  await ctx.db.insert("githubPullRequestReviewComments", record);
  return { ok: true as const };
}

export const upsertIssueCommentFromWebhookPayload = internalMutation({
  args: {
    teamId: v.string(),
    installationId: v.number(),
    repoFullName: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => upsertIssueComment(ctx, args),
});

export const upsertPullRequestReviewFromWebhookPayload = internalMutation({
  args: {
    teamId: v.string(),
    installationId: v.number(),
    repoFullName: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => upsertReview(ctx, args),
});

export const upsertPullRequestReviewCommentFromWebhookPayload = internalMutation({
  args: {
    teamId: v.string(),
    installationId: v.number(),
    repoFullName: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => upsertReviewComment(ctx, args),
});
