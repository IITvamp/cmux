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

async function upsertCommitStatus(
  ctx: MutationCtx,
  args: { teamId: string; installationId: number; repoFullName: string; payload: any }
) {
  const status = (args.payload ?? {}) as Record<string, any>;
  const sha = mapStr(status.sha) ?? mapStr(status.commit?.sha) ?? "";
  const context = mapStr(status.context) ?? "default";
  const state = mapStr(status.state) as "error" | "failure" | "pending" | "success" | undefined;
  if (!sha || !context || !state) return { ok: false as const };

  const updatedAt = ts(status.updated_at) ?? ts(status.created_at) ?? Date.now();

  // @ts-expect-error: New table will be in generated types after codegen
  const existing = await ctx.db
    .query("githubCommitStatuses")
    .withIndex("by_team_repo_sha_ctx", (q) =>
      q
        .eq("teamId", args.teamId)
        .eq("repoFullName", args.repoFullName)
        .eq("sha", sha)
        .eq("context", context)
    )
    .first();

  const record = {
    teamId: args.teamId,
    installationId: args.installationId,
    repoFullName: args.repoFullName,
    repositoryId: mapNum(args.payload?.repository?.id),
    sha,
    context,
    state,
    targetUrl: mapStr(status.target_url),
    description: mapStr(status.description),
    creatorLogin: mapStr(status?.creator?.login),
    creatorId: mapNum(status?.creator?.id),
    updatedAt,
  } as const;

  if (existing) {
    const prevState = existing.state;
    // @ts-expect-error: New table will be in generated types after codegen
    await ctx.db.patch(existing._id, record);
    if (prevState !== state) {
      // @ts-expect-error: New table will be in generated types after codegen
      await ctx.db.insert("githubCommitStatusHistory", {
        teamId: args.teamId,
        installationId: args.installationId,
        repoFullName: args.repoFullName,
        sha,
        context,
        state,
        updatedAt,
      });
    }
    return { ok: true as const };
  }
  // @ts-expect-error: New table will be in generated types after codegen
  await ctx.db.insert("githubCommitStatuses", record);
  // @ts-expect-error: New table will be in generated types after codegen
  await ctx.db.insert("githubCommitStatusHistory", {
    teamId: args.teamId,
    installationId: args.installationId,
    repoFullName: args.repoFullName,
    sha,
    context,
    state,
    updatedAt,
  });
  return { ok: true as const };
}

export const upsertCommitStatusFromWebhookPayload = internalMutation({
  args: {
    teamId: v.string(),
    installationId: v.number(),
    repoFullName: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => upsertCommitStatus(ctx, args),
});
