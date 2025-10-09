/**
 * GitHub Actions Workflow Runs
 *
 * Handles workflow_run webhooks from GitHub Actions.
 * These are runs of .github/workflows/*.yml files.
 *
 * NOT to be confused with:
 * - check_run events (see github_check_runs.ts) - third-party checks like Vercel
 * - deployment events (see github_deployments.ts) - deployment records
 * - status events (see github_commit_statuses.ts) - legacy commit statuses
 */
import { v } from "convex/values";
import { getTeamId } from "../_shared/team";
import {
  workflowRunWebhookPayload,
  type GithubWorkflowRunEventPayload,
} from "../_shared/github_webhook_validators";
import { internalMutation } from "./_generated/server";
import { authQuery } from "./users/utils";

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

export const upsertWorkflowRunFromWebhook = internalMutation({
  args: {
    installationId: v.number(),
    repoFullName: v.string(),
    teamId: v.string(),
    payload: workflowRunWebhookPayload,
  },
  handler: async (ctx, args) => {
    const payload: GithubWorkflowRunEventPayload = args.payload;
    const { installationId, repoFullName, teamId } = args;

    const workflowRun = payload.workflow_run;
    const workflowMeta = payload.workflow;

    if (!workflowRun || !workflowMeta) {
      console.warn("[upsertWorkflowRun] Missing workflow payload", {
        repoFullName,
        teamId,
        hasWorkflowRun: !!workflowRun,
        hasWorkflowMeta: !!workflowMeta,
      });
      return;
    }

    // Extract core workflow run data
    const runId = workflowRun.id;
    const runNumber = workflowRun.run_number;
    const workflowId = workflowRun.workflow_id;
    const workflowName = workflowMeta.name;
    const eventName = workflowRun.event;

    if (!runId || !runNumber || !workflowId || !workflowName || !eventName) {
      console.warn("[upsertWorkflowRun] Missing required fields", {
        runId,
        runNumber,
        workflowId,
        workflowName,
        eventName,
        repoFullName,
        teamId,
      });
      return;
    }

    // Map GitHub status to our schema status (exclude 'requested')
    const githubStatus = workflowRun.status;
    const validStatuses = ["queued", "in_progress", "completed", "pending", "waiting"] as const;
    type ValidStatus = (typeof validStatuses)[number];
    const isValidStatus = (value: string | null | undefined): value is ValidStatus =>
      typeof value === "string" && (validStatuses as readonly string[]).includes(value);
    const status: ValidStatus | undefined =
      githubStatus === "requested" ? undefined : isValidStatus(githubStatus) ? githubStatus : undefined;

    // Map GitHub conclusion to our schema conclusion (exclude 'stale' and handle null)
    const githubConclusion = workflowRun.conclusion;
    const validConclusions = [
      "success",
      "failure",
      "neutral",
      "cancelled",
      "skipped",
      "timed_out",
      "action_required",
    ] as const;
    type ValidConclusion = (typeof validConclusions)[number];
    const isValidConclusion = (
      value: string | null | undefined,
    ): value is ValidConclusion =>
      typeof value === "string" && (validConclusions as readonly string[]).includes(value);
    const conclusion: ValidConclusion | undefined =
      githubConclusion === "stale" || githubConclusion === null
        ? undefined
        : isValidConclusion(githubConclusion)
          ? githubConclusion
          : undefined;

    // Normalize timestamps
    const createdAt = normalizeTimestamp(workflowRun.created_at);
    const updatedAt = normalizeTimestamp(workflowRun.updated_at);
    const runStartedAt = normalizeTimestamp(workflowRun.run_started_at);

    const runCompletedAt =
      workflowRun.status === "completed"
        ? normalizeTimestamp(workflowRun.completed_at)
        : undefined;

    // Calculate run duration if we have both start and completion times
    let runDuration: number | undefined;
    if (runStartedAt && runCompletedAt) {
      runDuration = Math.round((runCompletedAt - runStartedAt) / 1000);
    }

    // Extract actor info
    const actorLogin = workflowRun.actor?.login;
    const actorId = workflowRun.actor?.id;

    // Extract triggering PR info if available
    let triggeringPrNumber: number | undefined;
    if (
      workflowRun.pull_requests &&
      workflowRun.pull_requests.length > 0
    ) {
      // Take the first PR if multiple are associated
      triggeringPrNumber = workflowRun.pull_requests[0]?.number;
    }

    // Prepare the document
    const workflowRunDoc = {
      provider: "github" as const,
      installationId,
      repositoryId: payload.repository?.id,
      repoFullName,
      runId,
      runNumber,
      teamId,
      workflowId,
      workflowName,
      name: workflowRun.name || undefined,
      event: eventName,
      status,
      conclusion,
      headBranch: workflowRun.head_branch || undefined,
      headSha: workflowRun.head_sha || undefined,
      htmlUrl: workflowRun.html_url || undefined,
      createdAt,
      updatedAt,
      runStartedAt,
      runCompletedAt,
      runDuration,
      actorLogin,
      actorId,
      triggeringPrNumber,
    };


    // Upsert the workflow run - fetch all matching records to handle duplicates
    const existingRecords = await ctx.db
      .query("githubWorkflowRuns")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .collect();

    if (existingRecords.length > 0) {
      // Update the first record
      await ctx.db.patch(existingRecords[0]._id, workflowRunDoc);

      // Delete any duplicates
      if (existingRecords.length > 1) {
        console.warn("[upsertWorkflowRun] Found duplicates, cleaning up", {
          runId,
          count: existingRecords.length,
          duplicateIds: existingRecords.slice(1).map(r => r._id),
        });
        for (const duplicate of existingRecords.slice(1)) {
          await ctx.db.delete(duplicate._id);
        }
      }
    } else {
      // Insert new run
      await ctx.db.insert("githubWorkflowRuns", workflowRunDoc);
    }
  },
});

// Query to get workflow runs for a team
export const getWorkflowRuns = authQuery({
  args: {
    teamSlugOrId: v.string(),
    repoFullName: v.optional(v.string()),
    workflowId: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { teamSlugOrId, repoFullName, workflowId, limit = 50 } = args;
    const teamId = await getTeamId(ctx, teamSlugOrId);

    let query = ctx.db
      .query("githubWorkflowRuns")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .order("desc");

    if (repoFullName) {
      query = ctx.db
        .query("githubWorkflowRuns")
        .withIndex("by_team_repo", (q) =>
          q.eq("teamId", teamId).eq("repoFullName", repoFullName),
        )
        .order("desc");
    }

    if (workflowId) {
      query = ctx.db
        .query("githubWorkflowRuns")
        .withIndex("by_team_workflow", (q) =>
          q.eq("teamId", teamId).eq("workflowId", workflowId),
        )
        .order("desc");
    }

    const runs = await query.take(limit);
    return runs;
  },
});

// Query to get a specific workflow run by ID
export const getWorkflowRunById = authQuery({
  args: {
    teamSlugOrId: v.string(),
    runId: v.number(),
  },
  handler: async (ctx, args) => {
    const { teamSlugOrId, runId } = args;
    const teamId = await getTeamId(ctx, teamSlugOrId);

    const run = await ctx.db
      .query("githubWorkflowRuns")
      .withIndex("by_runId")
      .filter((q) => q.eq(q.field("runId"), runId))
      .filter((q) => q.eq(q.field("teamId"), teamId))
      .unique();

    return run;
  },
});

// Query to get workflow runs for a specific PR
export const getWorkflowRunsForPr = authQuery({
  args: {
    teamSlugOrId: v.string(),
    repoFullName: v.string(),
    prNumber: v.number(),
    headSha: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { teamSlugOrId, repoFullName, prNumber, headSha, limit = 20 } = args;
    const teamId = await getTeamId(ctx, teamSlugOrId);


    // Fetch runs by headSha if provided (more efficient index lookup)
    // Source: workflow_run webhooks from GitHub Actions (NOT check_run events)
    let runs;
    if (headSha) {
      const shaRuns = await ctx.db
        .query("githubWorkflowRuns")
        .withIndex("by_repo_sha", (q) =>
          q.eq("repoFullName", repoFullName).eq("headSha", headSha)
        )
        .order("desc")
        .take(100); // Fetch extra to account for potential duplicates

      // Filter by teamId in memory (index doesn't include it)
      const filtered = shaRuns.filter(r => r.teamId === teamId);

      // Deduplicate by workflow name, keeping the most recently updated one
      const dedupMap = new Map<string, typeof filtered[number]>();
      for (const run of filtered) {
        const key = run.workflowName;
        const existing = dedupMap.get(key);
        if (!existing || (run.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
          dedupMap.set(key, run);
        }
      }
      runs = Array.from(dedupMap.values()).slice(0, limit);
    } else {
      // Fallback: fetch all for repo and filter (less efficient)
      const allRuns = await ctx.db
        .query("githubWorkflowRuns")
        .withIndex("by_team_repo", (q) =>
          q.eq("teamId", teamId).eq("repoFullName", repoFullName)
        )
        .order("desc")
        .take(200); // Fetch extra to account for potential duplicates

      const filtered = allRuns.filter(r => r.triggeringPrNumber === prNumber);

      // Deduplicate by workflow name, keeping the most recently updated one
      const dedupMap = new Map<string, typeof filtered[number]>();
      for (const run of filtered) {
        const key = run.workflowName;
        const existing = dedupMap.get(key);
        if (!existing || (run.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
          dedupMap.set(key, run);
        }
      }
      runs = Array.from(dedupMap.values()).slice(0, limit);
    }


    return runs;
  },
});
