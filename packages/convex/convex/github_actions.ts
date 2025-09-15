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

async function upsertWorkflowRun(
  ctx: MutationCtx,
  args: { teamId: string; installationId: number; repoFullName: string; payload: any }
) {
  const wr = (args.payload?.workflow_run ?? {}) as Record<string, any>;
  const runId = Number(wr.id ?? 0);
  if (!runId) return { ok: false as const };

  const status = mapStr(wr.status) as any;
  const conclusion = mapStr(wr.conclusion) as any;

  const record = {
    teamId: args.teamId,
    installationId: args.installationId,
    repoFullName: args.repoFullName,
    repositoryId: mapNum(args.payload?.repository?.id),
    runId,
    runNumber: mapNum(wr.run_number),
    runAttempt: mapNum(wr.run_attempt),
    workflowId: mapNum(wr.workflow_id),
    workflowName: mapStr(wr.name) ?? mapStr(wr?.workflow_name),
    name: mapStr(wr.display_title) ?? mapStr(wr.name),
    event: mapStr(wr.event),
    headBranch: mapStr(wr.head_branch),
    headSha: mapStr(wr.head_sha) ?? "",
    status,
    conclusion,
    checkSuiteId: mapNum(wr.check_suite_id),
    actorLogin: mapStr(wr?.actor?.login),
    actorId: mapNum(wr?.actor?.id),
    htmlUrl: mapStr(wr.html_url),
    createdAt: ts(wr.created_at),
    updatedAt: ts(wr.updated_at),
    runStartedAt: ts(wr.run_started_at),
  } as const;

  // @ts-expect-error: New table will be in generated types after codegen
  const existing = await ctx.db
    .query("githubWorkflowRuns")
    .withIndex("by_team_repo_run", (q) =>
      q
        .eq("teamId", args.teamId)
        .eq("repoFullName", args.repoFullName)
        .eq("runId", runId)
    )
    .first();

  const now = Date.now();
  if (existing) {
    const prevStatus = existing.status;
    const prevConclusion = existing.conclusion;
    // @ts-expect-error: New table will be in generated types after codegen
    await ctx.db.patch(existing._id, record);
    if (prevStatus !== status || prevConclusion !== conclusion) {
      // @ts-expect-error: New table will be in generated types after codegen
      await ctx.db.insert("githubWorkflowRunHistory", {
        teamId: args.teamId,
        installationId: args.installationId,
        repoFullName: args.repoFullName,
        runId,
        runAttempt: mapNum(wr.run_attempt),
        status,
        conclusion,
        createdAt:
          ts(wr.updated_at) ?? ts(wr.run_started_at) ?? ts(wr.created_at) ?? now,
      });
    }
    return { ok: true as const };
  }
  // @ts-expect-error: New table will be in generated types after codegen
  await ctx.db.insert("githubWorkflowRuns", record);
  // @ts-expect-error: New table will be in generated types after codegen
  await ctx.db.insert("githubWorkflowRunHistory", {
    teamId: args.teamId,
    installationId: args.installationId,
    repoFullName: args.repoFullName,
    runId,
    runAttempt: mapNum(wr.run_attempt),
    status,
    conclusion,
    createdAt: ts(wr.created_at) ?? now,
  });
  return { ok: true as const };
}

async function upsertWorkflowJob(
  ctx: MutationCtx,
  args: { teamId: string; installationId: number; repoFullName: string; payload: any }
) {
  const job = (args.payload?.workflow_job ?? {}) as Record<string, any>;
  const jobId = Number(job.id ?? 0);
  if (!jobId) return { ok: false as const };

  const status = mapStr(job.status) as any;
  const conclusion = mapStr(job.conclusion) as any;

  const record = {
    teamId: args.teamId,
    installationId: args.installationId,
    repoFullName: args.repoFullName,
    repositoryId: mapNum(args.payload?.repository?.id),
    jobId,
    runId: Number(job.run_id ?? args.payload?.workflow_run?.id ?? 0) || 0,
    runAttempt:
      mapNum(job.run_attempt ?? args.payload?.workflow_run?.run_attempt),
    name: mapStr(job.name),
    headSha: mapStr(job?.head_sha),
    status,
    conclusion,
    htmlUrl: mapStr(job.html_url),
    runnerName: mapStr(job.runner_name),
    labels: Array.isArray(job.labels)
      ? (job.labels as unknown[]).map((x) => String(x))
      : undefined,
    steps: Array.isArray(job.steps)
      ? (job.steps as unknown[]).map((s) => {
          const so = s as Record<string, any>;
          return {
            number: mapNum(so.number),
            name: mapStr(so.name),
            status: mapStr(so.status) as any,
            conclusion: mapStr(so.conclusion) as any,
            startedAt: ts(so.started_at),
            completedAt: ts(so.completed_at),
          };
        })
      : undefined,
    startedAt: ts(job.started_at),
    completedAt: ts(job.completed_at),
  } as const;

  // @ts-expect-error: New table will be in generated types after codegen
  const existing = await ctx.db
    .query("githubWorkflowJobs")
    .withIndex("by_team_repo_job", (q) =>
      q
        .eq("teamId", args.teamId)
        .eq("repoFullName", args.repoFullName)
        .eq("jobId", jobId)
    )
    .first();

  const now = Date.now();
  if (existing) {
    const prevStatus = existing.status;
    const prevConclusion = existing.conclusion;
    // @ts-expect-error: New table will be in generated types after codegen
    await ctx.db.patch(existing._id, record);
    if (prevStatus !== status || prevConclusion !== conclusion) {
      // @ts-expect-error: New table will be in generated types after codegen
      await ctx.db.insert("githubWorkflowJobHistory", {
        teamId: args.teamId,
        installationId: args.installationId,
        repoFullName: args.repoFullName,
        jobId,
        runId: record.runId,
        status,
        conclusion,
        createdAt:
          ts(job.completed_at) ?? ts(job.started_at) ?? ts(job.started_at) ?? now,
      });
    }
    return { ok: true as const };
  }
  // @ts-expect-error: New table will be in generated types after codegen
  await ctx.db.insert("githubWorkflowJobs", record);
  // @ts-expect-error: New table will be in generated types after codegen
  await ctx.db.insert("githubWorkflowJobHistory", {
    teamId: args.teamId,
    installationId: args.installationId,
    repoFullName: args.repoFullName,
    jobId,
    runId: record.runId,
    status,
    conclusion,
    createdAt: ts(job.started_at) ?? now,
  });
  return { ok: true as const };
}

export const upsertWorkflowRunFromWebhookPayload = internalMutation({
  args: {
    teamId: v.string(),
    installationId: v.number(),
    repoFullName: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => upsertWorkflowRun(ctx, args),
});

export const upsertWorkflowJobFromWebhookPayload = internalMutation({
  args: {
    teamId: v.string(),
    installationId: v.number(),
    repoFullName: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => upsertWorkflowJob(ctx, args),
});
