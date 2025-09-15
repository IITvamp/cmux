import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";

function mapStr(vv: unknown): string | undefined {
  return typeof vv === "string" ? vv : undefined;
}
function mapNum(vv: unknown): number | undefined {
  return typeof vv === "number" ? vv : undefined;
}
function mapBool(vv: unknown): boolean | undefined {
  return typeof vv === "boolean" ? vv : undefined;
}
function ts(vv: unknown): number | undefined {
  if (typeof vv !== "string") return undefined;
  const n = Date.parse(vv);
  return Number.isFinite(n) ? n : undefined;
}

async function upsertCheckSuite(
  ctx: MutationCtx,
  args: {
    teamId: string;
    installationId: number;
    repoFullName: string;
    payload: any;
  }
) {
  const suite = (args.payload?.check_suite ?? {}) as Record<string, any>;
  const checkSuiteId = Number(suite.id ?? 0);
  if (!checkSuiteId) return { ok: false as const };

  const record = {
    teamId: args.teamId,
    installationId: args.installationId,
    repoFullName: args.repoFullName,
    repositoryId: mapNum(args.payload?.repository?.id),
    checkSuiteId,
    headBranch: mapStr(suite.head_branch),
    headSha: mapStr(suite.head_sha) ?? "",
    status: mapStr(suite.status) as any,
    conclusion: mapStr(suite.conclusion) as any,
    latestCheckRunsCount: mapNum(suite.latest_check_runs_count),
    before: mapStr(suite.before),
    after: mapStr(suite.after),
    appSlug: mapStr(suite?.app?.slug),
    createdAt: ts(suite.created_at),
    updatedAt: ts(suite.updated_at),
  } as const;

  // @ts-expect-error: New table will be in generated types after codegen
  const existing = await ctx.db
    .query("githubCheckSuites")
    .withIndex("by_team_repo_suite", (q) =>
      q
        .eq("teamId", args.teamId)
        .eq("repoFullName", args.repoFullName)
        .eq("checkSuiteId", checkSuiteId)
    )
    .first();
  if (existing) {
    // @ts-expect-error: New table will be in generated types after codegen
    await ctx.db.patch(existing._id, record);
    return { ok: true as const };
  }
  // @ts-expect-error: New table will be in generated types after codegen
  await ctx.db.insert("githubCheckSuites", record);
  return { ok: true as const };
}

async function upsertCheckRun(
  ctx: MutationCtx,
  args: {
    teamId: string;
    installationId: number;
    repoFullName: string;
    payload: any;
  }
) {
  const run = (args.payload?.check_run ?? {}) as Record<string, any>;
  const checkRunId = Number(run.id ?? 0);
  if (!checkRunId) return { ok: false as const };

  const status = mapStr(run.status) as any;
  const conclusion = mapStr(run.conclusion) as any;

  const record = {
    teamId: args.teamId,
    installationId: args.installationId,
    repoFullName: args.repoFullName,
    repositoryId: mapNum(args.payload?.repository?.id),
    checkRunId,
    checkSuiteId: mapNum(run?.check_suite?.id ?? args.payload?.check_suite?.id),
    name: mapStr(run.name),
    headSha: mapStr(run.head_sha) ?? "",
    status,
    conclusion,
    externalId: mapStr(run.external_id),
    detailsUrl: mapStr(run.details_url),
    htmlUrl: mapStr(run.html_url),
    startedAt: ts(run.started_at),
    completedAt: ts(run.completed_at),
    output: (():
      | {
          title?: string;
          summary?: string;
          text?: string;
          annotationsCount?: number;
          annotationsUrl?: string;
        }
      | undefined => {
      const out = run.output as Record<string, any> | undefined;
      if (!out) return undefined;
      return {
        title: mapStr(out.title),
        summary: mapStr(out.summary),
        text: mapStr(out.text),
        annotationsCount: mapNum(out.annotations_count),
        annotationsUrl: mapStr(out.annotations_url),
      };
    })(),
    appSlug: mapStr(run?.app?.slug),
  } as const;

  // @ts-expect-error: New table will be in generated types after codegen
  const existing = await ctx.db
    .query("githubCheckRuns")
    .withIndex("by_team_repo_run", (q) =>
      q
        .eq("teamId", args.teamId)
        .eq("repoFullName", args.repoFullName)
        .eq("checkRunId", checkRunId)
    )
    .first();

  const now = Date.now();
  if (existing) {
    const prevStatus = existing.status;
    const prevConclusion = (existing as any).conclusion as
      | string
      | undefined;
    // @ts-expect-error: New table will be in generated types after codegen
    await ctx.db.patch(existing._id, record);
    if (prevStatus !== status || prevConclusion !== conclusion) {
      // @ts-expect-error: New table will be in generated types after codegen
      await ctx.db.insert("githubCheckRunHistory", {
        teamId: args.teamId,
        installationId: args.installationId,
        repoFullName: args.repoFullName,
        checkRunId,
        status,
        conclusion,
        createdAt:
          ts(run.completed_at) ?? ts(run.started_at) ?? ts(run.created_at) ?? now,
      });
    }
    return { ok: true as const };
  }
  // @ts-expect-error: New table will be in generated types after codegen
  await ctx.db.insert("githubCheckRuns", record);
  // @ts-expect-error: New table will be in generated types after codegen
  await ctx.db.insert("githubCheckRunHistory", {
    teamId: args.teamId,
    installationId: args.installationId,
    repoFullName: args.repoFullName,
    checkRunId,
    status,
    conclusion,
    createdAt: ts(run.created_at) ?? now,
  });
  return { ok: true as const };
}

export const upsertCheckSuiteFromWebhookPayload = internalMutation({
  args: {
    teamId: v.string(),
    installationId: v.number(),
    repoFullName: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => upsertCheckSuite(ctx, args),
});

export const upsertCheckRunFromWebhookPayload = internalMutation({
  args: {
    teamId: v.string(),
    installationId: v.number(),
    repoFullName: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => upsertCheckRun(ctx, args),
});
