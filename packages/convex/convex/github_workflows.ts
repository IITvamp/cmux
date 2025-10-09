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
import { internalMutation } from "./_generated/server";
import { authQuery } from "./users/utils";

const timestampValue = v.union(v.string(), v.number());

export type WorkflowRunWebhookPayload = {
  runId?: number;
  runNumber?: number;
  workflowId?: number;
  workflowName?: string;
  runName?: string;
  event?: string;
  status?: string;
  conclusion?: string;
  repositoryId?: number;
  headBranch?: string;
  headSha?: string;
  htmlUrl?: string;
  createdAt?: string | number;
  updatedAt?: string | number;
  runStartedAt?: string | number;
  runCompletedAt?: string | number;
  actorLogin?: string;
  actorId?: number;
  pullRequestNumbers?: number[];
};

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
    payload: v.object({
      runId: v.optional(v.number()),
      runNumber: v.optional(v.number()),
      workflowId: v.optional(v.number()),
      workflowName: v.optional(v.string()),
      runName: v.optional(v.string()),
      event: v.optional(v.string()),
      status: v.optional(v.string()),
      conclusion: v.optional(v.string()),
      repositoryId: v.optional(v.number()),
      headBranch: v.optional(v.string()),
      headSha: v.optional(v.string()),
      htmlUrl: v.optional(v.string()),
      createdAt: v.optional(timestampValue),
      updatedAt: v.optional(timestampValue),
      runStartedAt: v.optional(timestampValue),
      runCompletedAt: v.optional(timestampValue),
      actorLogin: v.optional(v.string()),
      actorId: v.optional(v.number()),
      pullRequestNumbers: v.optional(v.array(v.number())),
    }),
  },
  handler: async (ctx, args) => {
    const { installationId, repoFullName, teamId, payload } = args;


    // Extract core workflow run data
    const runId = payload.runId;
    const runNumber = payload.runNumber;
    const workflowId = payload.workflowId;
    const workflowName = payload.workflowName;

    if (!runId || !runNumber || !workflowId || !workflowName) {
      console.warn("[upsertWorkflowRun] Missing required fields", {
        runId,
        runNumber,
        workflowId,
        workflowName,
        repoFullName,
        teamId,
      });
      return;
    }

    // Map GitHub status to our schema status (exclude 'requested')
    const githubStatus = payload.status;
    const status = githubStatus === "requested" ? undefined : githubStatus;

    // Map GitHub conclusion to our schema conclusion (exclude 'stale' and handle null)
    const githubConclusion = payload.conclusion;
    const conclusion =
      githubConclusion === "stale" || githubConclusion === null
        ? undefined
        : githubConclusion;

    // Normalize timestamps
    const createdAt = normalizeTimestamp(payload.createdAt);
    const updatedAt = normalizeTimestamp(payload.updatedAt);
    const runStartedAt = normalizeTimestamp(payload.runStartedAt);

    const runCompletedAt =
      payload.status === "completed"
        ? normalizeTimestamp(payload.runCompletedAt)
        : undefined;

    // Calculate run duration if we have both start and completion times
    let runDuration: number | undefined;
    if (runStartedAt && runCompletedAt) {
      runDuration = Math.round((runCompletedAt - runStartedAt) / 1000);
    }

    // Extract actor info
    const actorLogin = payload.actorLogin;
    const actorId = payload.actorId;

    // Extract triggering PR info if available
    let triggeringPrNumber: number | undefined;
    if (payload.pullRequestNumbers && payload.pullRequestNumbers.length > 0) {
      // Take the first PR if multiple are associated
      triggeringPrNumber = payload.pullRequestNumbers[0];
    }

    // Prepare the document
    const workflowRunDoc = {
      provider: "github" as const,
      installationId,
      repositoryId: payload.repositoryId,
      repoFullName,
      runId,
      runNumber,
      teamId,
      workflowId,
      workflowName,
      name: payload.runName || undefined,
      event: payload.event,
      status,
      conclusion,
      headBranch: payload.headBranch || undefined,
      headSha: payload.headSha || undefined,
      htmlUrl: payload.htmlUrl || undefined,
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
