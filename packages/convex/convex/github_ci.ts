import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

function mapStr(vv: unknown): string | undefined {
  return typeof vv === "string" ? vv : undefined;
}

function mapNum(vv: unknown): number | undefined {
  return typeof vv === "number" && Number.isFinite(vv) ? vv : undefined;
}

function ts(vv: unknown): number | undefined {
  if (typeof vv !== "string") return undefined;
  const n = Date.parse(vv);
  return Number.isFinite(n) ? n : undefined;
}

export const upsertCheckSuiteFromWebhook = internalMutation({
  args: {
    installationId: v.number(),
    repoFullName: v.string(),
    repositoryId: v.optional(v.number()),
    teamId: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, { installationId, repoFullName, repositoryId, teamId, payload }) => {
    try {
      const suite = (payload?.check_suite ?? {}) as Record<string, unknown>;
      const suiteId = Number(suite.id ?? payload?.id ?? 0);
      const headSha = mapStr((suite as any)?.head_sha) ?? mapStr(payload?.head_sha) ?? "";
      if (!suiteId || !headSha) return { ok: false as const };
      const statusRaw = mapStr((suite as any)?.status) ?? "queued";
      const status = ["queued", "in_progress", "completed"].includes(statusRaw)
        ? (statusRaw as "queued" | "in_progress" | "completed")
        : "queued";
      const conclusionRaw = mapStr((suite as any)?.conclusion);
      const allowedConcl = new Set([
        "success",
        "failure",
        "neutral",
        "cancelled",
        "timed_out",
        "action_required",
        "stale",
        "skipped",
        "startup_failure",
      ]);
      const conclusion = conclusionRaw && allowedConcl.has(conclusionRaw)
        ? (conclusionRaw as typeof conclusionRaw)
        : undefined;
      const appSlug = mapStr((suite as any)?.app?.slug);

      const existing = await ctx.db
        .query("githubCheckSuites")
        .withIndex("by_team_repo_suite", (q) =>
          q.eq("teamId", teamId).eq("repoFullName", repoFullName).eq("suiteId", suiteId)
        )
        .first();
      const patch = {
        provider: "github" as const,
        installationId,
        teamId,
        repositoryId,
        repoFullName,
        suiteId,
        headSha,
        status,
        conclusion,
        appSlug,
        createdAt: ts((suite as any)?.created_at),
        updatedAt: ts((suite as any)?.updated_at),
      };
      if (existing) {
        await ctx.db.patch(existing._id, patch);
      } else {
        await ctx.db.insert("githubCheckSuites", patch);
      }

      // history event
      const action = mapStr(payload?.action) ?? "unknown";
      await ctx.db.insert("githubCiEvents", {
        provider: "github",
        installationId,
        teamId,
        repoFullName,
        type: "check_suite",
        action,
        sha: headSha,
        suiteId,
        createdAt: ts((suite as any)?.updated_at) ?? Date.now(),
        receivedAt: Date.now(),
      });

      return { ok: true as const };
    } catch (_err) {
      return { ok: false as const };
    }
  },
});

export const upsertCheckRunFromWebhook = internalMutation({
  args: {
    installationId: v.number(),
    repoFullName: v.string(),
    repositoryId: v.optional(v.number()),
    teamId: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, { installationId, repoFullName, repositoryId, teamId, payload }) => {
    try {
      const run = (payload?.check_run ?? {}) as Record<string, unknown>;
      const runId = Number(run.id ?? payload?.id ?? 0);
      const headSha = mapStr((run as any)?.head_sha) ?? mapStr(payload?.head_sha) ?? "";
      const name = mapStr((run as any)?.name) ?? "";
      if (!runId || !headSha || !name) return { ok: false as const };
      const statusRaw = mapStr((run as any)?.status) ?? "queued";
      const status = ["queued", "in_progress", "completed"].includes(statusRaw)
        ? (statusRaw as "queued" | "in_progress" | "completed")
        : "queued";
      const conclusionRaw = mapStr((run as any)?.conclusion);
      const allowedConcl = new Set([
        "success",
        "failure",
        "neutral",
        "cancelled",
        "timed_out",
        "action_required",
        "stale",
        "skipped",
        "startup_failure",
      ]);
      const conclusion = conclusionRaw && allowedConcl.has(conclusionRaw)
        ? (conclusionRaw as typeof conclusionRaw)
        : undefined;
      const appSlug = mapStr((run as any)?.app?.slug);
      const suiteId = mapNum((run as any)?.check_suite?.id) ?? mapNum((payload as any)?.check_suite?.id);
      const externalId = mapStr((run as any)?.external_id);
      const htmlUrl = mapStr((run as any)?.html_url) ?? mapStr((run as any)?.details_url);
      const startedAt = ts((run as any)?.started_at);
      const completedAt = ts((run as any)?.completed_at);

      const existing = await ctx.db
        .query("githubCheckRuns")
        .withIndex("by_team_repo_run", (q) =>
          q.eq("teamId", teamId).eq("repoFullName", repoFullName).eq("runId", runId)
        )
        .first();
      const patch = {
        provider: "github" as const,
        installationId,
        teamId,
        repositoryId,
        repoFullName,
        runId,
        suiteId,
        name,
        status,
        conclusion,
        headSha,
        appSlug,
        externalId,
        htmlUrl,
        startedAt,
        completedAt,
      };
      if (existing) {
        await ctx.db.patch(existing._id, patch);
      } else {
        await ctx.db.insert("githubCheckRuns", patch);
      }

      // history event
      const action = mapStr(payload?.action) ?? "unknown";
      await ctx.db.insert("githubCiEvents", {
        provider: "github",
        installationId,
        teamId,
        repoFullName,
        type: "check_run",
        action,
        sha: headSha,
        runId,
        suiteId,
        status,
        conclusion,
        name,
        createdAt: completedAt ?? startedAt ?? Date.now(),
        receivedAt: Date.now(),
      });

      return { ok: true as const };
    } catch (_err) {
      return { ok: false as const };
    }
  },
});

export const upsertCommitStatusFromWebhook = internalMutation({
  args: {
    installationId: v.number(),
    repoFullName: v.string(),
    repositoryId: v.optional(v.number()),
    teamId: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, { installationId, repoFullName, repositoryId, teamId, payload }) => {
    try {
      const stateRaw = mapStr(payload?.state) ?? "pending";
      const stateAllowed = new Set(["error", "failure", "pending", "success"]);
      const state = stateAllowed.has(stateRaw) ? (stateRaw as typeof stateRaw) : "pending";
      const sha = mapStr(payload?.sha) ?? "";
      const context = mapStr(payload?.context) ?? "default";
      if (!sha || !context) return { ok: false as const };
      const description = mapStr(payload?.description);
      const targetUrl = mapStr(payload?.target_url);
      const statusId = mapNum(payload?.id);
      const createdAt = ts(payload?.created_at);
      const updatedAt = ts(payload?.updated_at);

      const existing = await ctx.db
        .query("githubCommitStatuses")
        .withIndex("by_team_repo_sha_ctx", (q) =>
          q.eq("teamId", teamId).eq("repoFullName", repoFullName).eq("sha", sha).eq("context", context)
        )
        .first();
      const patch = {
        provider: "github" as const,
        installationId,
        teamId,
        repositoryId,
        repoFullName,
        statusId,
        sha,
        context,
        state,
        description,
        targetUrl,
        createdAt,
        updatedAt,
      };
      if (existing) {
        await ctx.db.patch(existing._id, patch);
      } else {
        await ctx.db.insert("githubCommitStatuses", patch);
      }

      // history event
      const action = mapStr(payload?.action) ?? "status";
      await ctx.db.insert("githubCiEvents", {
        provider: "github",
        installationId,
        teamId,
        repoFullName,
        type: "status",
        action,
        sha,
        context,
        status: state,
        createdAt: updatedAt ?? createdAt ?? Date.now(),
        receivedAt: Date.now(),
      });

      return { ok: true as const };
    } catch (_err) {
      return { ok: false as const };
    }
  },
});

export const upsertWorkflowRunFromWebhook = internalMutation({
  args: {
    installationId: v.number(),
    repoFullName: v.string(),
    repositoryId: v.optional(v.number()),
    teamId: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, { installationId, repoFullName, repositoryId, teamId, payload }) => {
    try {
      const wr = (payload?.workflow_run ?? {}) as Record<string, unknown>;
      const runId = Number(wr.id ?? 0);
      const headSha = mapStr((wr as any)?.head_sha) ?? "";
      if (!runId || !headSha) return { ok: false as const };
      const statusRaw = mapStr((wr as any)?.status) ?? "queued";
      const status = ["queued", "in_progress", "completed"].includes(statusRaw)
        ? (statusRaw as "queued" | "in_progress" | "completed")
        : "queued";
      const conclusionRaw = mapStr((wr as any)?.conclusion);
      const allowedConcl = new Set([
        "success",
        "failure",
        "neutral",
        "cancelled",
        "timed_out",
        "action_required",
        "stale",
        "skipped",
        "startup_failure",
      ]);
      const conclusion = conclusionRaw && allowedConcl.has(conclusionRaw)
        ? (conclusionRaw as typeof conclusionRaw)
        : undefined;
      const workflowId = mapNum((wr as any)?.workflow_id);
      const name = mapStr((wr as any)?.name);
      const headBranch = mapStr((wr as any)?.head_branch);
      const event = mapStr((wr as any)?.event);
      const htmlUrl = mapStr((wr as any)?.html_url);
      const runNumber = mapNum((wr as any)?.run_number);
      const createdAt = ts((wr as any)?.created_at);
      const updatedAt = ts((wr as any)?.updated_at);
      const runStartedAt = ts((wr as any)?.run_started_at);

      const existing = await ctx.db
        .query("githubWorkflowRuns")
        .withIndex("by_team_repo_run", (q) =>
          q.eq("teamId", teamId).eq("repoFullName", repoFullName).eq("runId", runId)
        )
        .first();
      const patch = {
        provider: "github" as const,
        installationId,
        teamId,
        repositoryId,
        repoFullName,
        runId,
        workflowId,
        name,
        headBranch,
        headSha,
        status,
        conclusion,
        event,
        htmlUrl,
        runNumber,
        createdAt,
        updatedAt,
        runStartedAt,
      };
      if (existing) {
        await ctx.db.patch(existing._id, patch);
      } else {
        await ctx.db.insert("githubWorkflowRuns", patch);
      }

      // history event
      const action = mapStr(payload?.action) ?? "unknown";
      await ctx.db.insert("githubCiEvents", {
        provider: "github",
        installationId,
        teamId,
        repoFullName,
        type: "workflow_run",
        action,
        sha: headSha,
        runId,
        status,
        conclusion,
        name,
        createdAt: updatedAt ?? runStartedAt ?? createdAt ?? Date.now(),
        receivedAt: Date.now(),
      });

      return { ok: true as const };
    } catch (_err) {
      return { ok: false as const };
    }
  },
});

export const upsertWorkflowJobFromWebhook = internalMutation({
  args: {
    installationId: v.number(),
    repoFullName: v.string(),
    repositoryId: v.optional(v.number()),
    teamId: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, { installationId, repoFullName, repositoryId, teamId, payload }) => {
    try {
      const job = (payload?.workflow_job ?? {}) as Record<string, unknown>;
      const jobId = Number(job.id ?? 0);
      const runId = Number((job as any)?.run_id ?? 0);
      if (!jobId || !runId) return { ok: false as const };
      const name = mapStr((job as any)?.name) ?? "";
      const statusRaw = mapStr((job as any)?.status) ?? "queued";
      const status = ["queued", "in_progress", "completed"].includes(statusRaw)
        ? (statusRaw as "queued" | "in_progress" | "completed")
        : "queued";
      const conclusionRaw = mapStr((job as any)?.conclusion);
      const allowedConcl = new Set([
        "success",
        "failure",
        "neutral",
        "cancelled",
        "timed_out",
        "action_required",
        "stale",
        "skipped",
        "startup_failure",
      ]);
      const conclusion = conclusionRaw && allowedConcl.has(conclusionRaw)
        ? (conclusionRaw as typeof conclusionRaw)
        : undefined;
      const htmlUrl = mapStr((job as any)?.html_url);
      const runnerName = mapStr((job as any)?.runner_name);
      const startedAt = ts((job as any)?.started_at);
      const completedAt = ts((job as any)?.completed_at);

      const existing = await ctx.db
        .query("githubWorkflowJobs")
        .withIndex("by_team_repo_job", (q) =>
          q.eq("teamId", teamId).eq("repoFullName", repoFullName).eq("jobId", jobId)
        )
        .first();
      const patch = {
        provider: "github" as const,
        installationId,
        teamId,
        repositoryId,
        repoFullName,
        jobId,
        runId,
        name,
        status,
        conclusion,
        htmlUrl,
        runnerName,
        startedAt,
        completedAt,
      };
      if (existing) {
        await ctx.db.patch(existing._id, patch);
      } else {
        await ctx.db.insert("githubWorkflowJobs", patch);
      }

      // history event
      const action = mapStr(payload?.action) ?? "unknown";
      await ctx.db.insert("githubCiEvents", {
        provider: "github",
        installationId,
        teamId,
        repoFullName,
        type: "workflow_job",
        action,
        jobId,
        runId,
        status,
        conclusion,
        name,
        createdAt: completedAt ?? startedAt ?? Date.now(),
        receivedAt: Date.now(),
      });

      return { ok: true as const };
    } catch (_err) {
      return { ok: false as const };
    }
  },
});

