import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Map GitHub installation to teamId via providerConnections
export const getTeamIdForInstallation = internalQuery({
  args: { installationId: v.number() },
  handler: async (ctx, { installationId }) => {
    const row = await ctx.db
      .query("providerConnections")
      .withIndex("by_installationId", (q) => q.eq("installationId", installationId))
      .first();
    return row?.teamId;
  },
});

// Idempotency check for webhook deliveries
export const recordWebhookDelivery = internalMutation({
  args: {
    provider: v.literal("github"),
    deliveryId: v.string(),
    installationId: v.optional(v.number()),
    payloadHash: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_deliveryId", (q) => q.eq("deliveryId", args.deliveryId))
      .first();
    if (existing) return { alreadyProcessed: true as const };
    await ctx.db.insert("webhookDeliveries", {
      ...args,
      receivedAt: Date.now(),
    });
    return { alreadyProcessed: false as const };
  },
});

// Upsert a GitHub workflow run
export const upsertWorkflowRun = internalMutation({
  args: {
    installationId: v.number(),
    repoFullName: v.string(),
    repositoryId: v.optional(v.number()),
    run: v.object({
      id: v.number(),
      run_number: v.optional(v.number()),
      workflow_id: v.optional(v.number()),
      name: v.optional(v.string()),
      status: v.optional(v.string()),
      conclusion: v.optional(v.string()),
      head_branch: v.optional(v.string()),
      head_sha: v.optional(v.string()),
      event: v.optional(v.string()),
      html_url: v.optional(v.string()),
      created_at: v.optional(v.string()),
      updated_at: v.optional(v.string()),
      run_started_at: v.optional(v.string()),
      completed_at: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { installationId, repoFullName, repositoryId, run }) => {
    const teamId = await ctx.runQuery(getTeamIdForInstallation, { installationId });
    const existing = await ctx.db
      .query("workflowRuns")
      .withIndex("by_installation", (q) => q.eq("installationId", installationId))
      .filter((q) => q.eq(q.field("runId"), run.id))
      .first();

    const toMillis = (s?: string) => (s ? Date.parse(s) : undefined);
    const doc = {
      provider: "github" as const,
      installationId,
      repoFullName,
      repositoryId,
      runId: run.id,
      runNumber: run.run_number,
      workflowId: run.workflow_id,
      workflowName: run.name,
      status: run.status as any,
      conclusion: run.conclusion as any,
      headBranch: run.head_branch,
      headSha: run.head_sha,
      event: run.event,
      htmlUrl: run.html_url,
      createdAt: toMillis(run.created_at),
      updatedAt: toMillis(run.updated_at),
      runStartedAt: toMillis(run.run_started_at),
      completedAt: toMillis(run.completed_at),
      teamId,
    };

    if (existing) {
      await ctx.db.patch(existing._id, doc);
      return existing._id;
    }
    return await ctx.db.insert("workflowRuns", doc);
  },
});

// Upsert a GitHub check_run
export const upsertCheckRun = internalMutation({
  args: {
    installationId: v.number(),
    repoFullName: v.string(),
    repositoryId: v.optional(v.number()),
    check: v.object({
      id: v.number(),
      external_id: v.optional(v.string()),
      name: v.string(),
      status: v.optional(v.string()),
      conclusion: v.optional(v.string()),
      details_url: v.optional(v.string()),
      html_url: v.optional(v.string()),
      head_sha: v.optional(v.string()),
      started_at: v.optional(v.string()),
      completed_at: v.optional(v.string()),
      output: v.optional(
        v.object({
          title: v.optional(v.string()),
          summary: v.optional(v.string()),
          text: v.optional(v.string()),
        })
      ),
    }),
  },
  handler: async (ctx, { installationId, repoFullName, repositoryId, check }) => {
    const teamId = await ctx.runQuery(getTeamIdForInstallation, { installationId });
    const existing = await ctx.db
      .query("checkRuns")
      .withIndex("by_installation", (q) => q.eq("installationId", installationId))
      .filter((q) => q.eq(q.field("checkRunId"), check.id))
      .first();
    const toMillis = (s?: string) => (s ? Date.parse(s) : undefined);
    const doc = {
      provider: "github" as const,
      installationId,
      repoFullName,
      repositoryId,
      checkRunId: check.id,
      externalId: check.external_id,
      name: check.name,
      status: check.status as any,
      conclusion: check.conclusion as any,
      detailsUrl: check.details_url,
      htmlUrl: check.html_url,
      headSha: check.head_sha,
      startedAt: toMillis(check.started_at),
      completedAt: toMillis(check.completed_at),
      outputTitle: check.output?.title,
      outputSummary: check.output?.summary,
      outputText: check.output?.text,
      teamId,
    };
    if (existing) {
      await ctx.db.patch(existing._id, doc);
      return existing._id;
    }
    return await ctx.db.insert("checkRuns", doc);
  },
});

