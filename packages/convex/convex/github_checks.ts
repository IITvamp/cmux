import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
} from "./_generated/server";

type GithubCheckExecutionType =
  | "status"
  | "check_suite"
  | "check_run"
  | "workflow_run"
  | "workflow_job";

export type UpsertExecutionArgs = {
  teamId: string;
  installationId: number;
  repoFullName: string;
  commitSha: string;
  type: GithubCheckExecutionType;
  externalId: string;
  name?: string;
  status?: string;
  conclusion?: string | null;
  detailsUrl?: string | null;
  htmlUrl?: string | null;
  description?: string | null;
  context?: string | null;
  appSlug?: string | null;
  workflowName?: string | null;
  workflowPath?: string | null;
  jobName?: string | null;
  runAttempt?: number | null;
  checkSuiteId?: number | null;
  workflowRunId?: number | null;
  headBranch?: string | null;
  startedAt?: number | null;
  completedAt?: number | null;
  eventAction?: string | null;
  eventTimestamp?: number | null;
};

const executionArgs = {
  teamId: v.string(),
  installationId: v.number(),
  repoFullName: v.string(),
  commitSha: v.string(),
  type: v.union(
    v.literal("status"),
    v.literal("check_suite"),
    v.literal("check_run"),
    v.literal("workflow_run"),
    v.literal("workflow_job")
  ),
  externalId: v.string(),
  name: v.optional(v.string()),
  status: v.optional(v.string()),
  conclusion: v.optional(v.string()),
  detailsUrl: v.optional(v.string()),
  htmlUrl: v.optional(v.string()),
  description: v.optional(v.string()),
  context: v.optional(v.string()),
  appSlug: v.optional(v.string()),
  workflowName: v.optional(v.string()),
  workflowPath: v.optional(v.string()),
  jobName: v.optional(v.string()),
  runAttempt: v.optional(v.number()),
  checkSuiteId: v.optional(v.number()),
  workflowRunId: v.optional(v.number()),
  headBranch: v.optional(v.string()),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  eventAction: v.optional(v.string()),
  eventTimestamp: v.optional(v.number()),
} as const;

const buildExecutionRecord = (args: UpsertExecutionArgs, now: number) => ({
  provider: "github" as const,
  installationId: args.installationId,
  repoFullName: args.repoFullName,
  commitSha: args.commitSha,
  type: args.type,
  externalId: args.externalId,
  teamId: args.teamId,
  name: args.name ?? undefined,
  status: args.status ?? undefined,
  conclusion: args.conclusion ?? undefined,
  detailsUrl: args.detailsUrl ?? undefined,
  htmlUrl: args.htmlUrl ?? undefined,
  description: args.description ?? undefined,
  context: args.context ?? undefined,
  appSlug: args.appSlug ?? undefined,
  workflowName: args.workflowName ?? undefined,
  workflowPath: args.workflowPath ?? undefined,
  jobName: args.jobName ?? undefined,
  runAttempt: args.runAttempt ?? undefined,
  checkSuiteId: args.checkSuiteId ?? undefined,
  workflowRunId: args.workflowRunId ?? undefined,
  headBranch: args.headBranch ?? undefined,
  startedAt: args.startedAt ?? undefined,
  completedAt: args.completedAt ?? undefined,
  lastEventAction: args.eventAction ?? undefined,
  lastEventTimestamp: args.eventTimestamp ?? undefined,
  updatedAt: now,
});

const insertHistory = async (
  ctx: MutationCtx,
  executionId: Id<"githubCheckExecutions">,
  args: UpsertExecutionArgs,
  receivedAt: number
) => {
  await ctx.db.insert("githubCheckExecutionHistory", {
    executionId,
    provider: "github",
    installationId: args.installationId,
    repoFullName: args.repoFullName,
    commitSha: args.commitSha,
    type: args.type,
    externalId: args.externalId,
    teamId: args.teamId,
    action: args.eventAction ?? undefined,
    name: args.name ?? undefined,
    status: args.status ?? undefined,
    conclusion: args.conclusion ?? undefined,
    detailsUrl: args.detailsUrl ?? undefined,
    htmlUrl: args.htmlUrl ?? undefined,
    description: args.description ?? undefined,
    context: args.context ?? undefined,
    appSlug: args.appSlug ?? undefined,
    workflowName: args.workflowName ?? undefined,
    workflowPath: args.workflowPath ?? undefined,
    jobName: args.jobName ?? undefined,
    runAttempt: args.runAttempt ?? undefined,
    checkSuiteId: args.checkSuiteId ?? undefined,
    workflowRunId: args.workflowRunId ?? undefined,
    headBranch: args.headBranch ?? undefined,
    startedAt: args.startedAt ?? undefined,
    completedAt: args.completedAt ?? undefined,
    eventTimestamp: args.eventTimestamp ?? undefined,
    receivedAt,
  });
};

export const upsertExecutionFromEvent = internalMutation({
  args: executionArgs,
  handler: async (ctx, args) => {
    const now = Date.now();
    const upsertArgs: UpsertExecutionArgs = { ...args };
    const existing = await ctx.db
      .query("githubCheckExecutions")
      .withIndex("by_installation_external", (q) =>
        q
          .eq("installationId", upsertArgs.installationId)
          .eq("type", upsertArgs.type)
          .eq("externalId", upsertArgs.externalId)
      )
      .first();

    const record = buildExecutionRecord(upsertArgs, now);

    if (existing) {
      await ctx.db.patch(existing._id, record);
      await insertHistory(ctx, existing._id, upsertArgs, now);
      return { executionId: existing._id, created: false as const };
    }

    const executionId = await ctx.db.insert("githubCheckExecutions", {
      ...record,
      createdAt: now,
    });
    await insertHistory(ctx, executionId, upsertArgs, now);
    return { executionId, created: true as const };
  },
});
