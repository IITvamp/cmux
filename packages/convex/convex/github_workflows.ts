import { v } from "convex/values";
import { getTeamId } from "../_shared/team";
import { internalMutation } from "./_generated/server";
import { authQuery, authMutation } from "./users/utils";
import type { WorkflowRunEvent } from "@octokit/webhooks-types";

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
    payload: v.any(), // WorkflowRunEvent from webhook
  },
  handler: async (ctx, args) => {
    const payload = args.payload as WorkflowRunEvent;
    const { installationId, repoFullName, teamId } = args;

    console.log("[upsertWorkflowRun] Starting", {
      teamId,
      repoFullName,
      installationId,
      action: payload.action,
    });

    // Extract core workflow run data
    const runId = payload.workflow_run?.id;
    const runNumber = payload.workflow_run?.run_number;
    const workflowId = payload.workflow_run?.workflow_id;
    const workflowName = payload.workflow?.name;

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
    const githubStatus = payload.workflow_run?.status;
    const status = githubStatus === "requested" ? undefined : githubStatus;

    // Map GitHub conclusion to our schema conclusion (exclude 'stale' and handle null)
    const githubConclusion = payload.workflow_run?.conclusion;
    const conclusion =
      githubConclusion === "stale" || githubConclusion === null
        ? undefined
        : githubConclusion;

    // Normalize timestamps
    const createdAt = normalizeTimestamp(payload.workflow_run?.created_at);
    const updatedAt = normalizeTimestamp(payload.workflow_run?.updated_at);
    const runStartedAt = normalizeTimestamp(
      payload.workflow_run?.run_started_at,
    );

    // Handle completed_at - it might not exist on the base WorkflowRun type
    let runCompletedAt: number | undefined;
    if (payload.workflow_run?.status === "completed") {
      // For completed runs, try to get the completed_at from the payload
      const completedAtRaw = (payload.workflow_run as any)?.completed_at;
      runCompletedAt = normalizeTimestamp(completedAtRaw);
    }

    // Calculate run duration if we have both start and completion times
    let runDuration: number | undefined;
    if (runStartedAt && runCompletedAt) {
      runDuration = Math.round((runCompletedAt - runStartedAt) / 1000);
    }

    // Extract actor info
    const actorLogin = payload.workflow_run?.actor?.login;
    const actorId = payload.workflow_run?.actor?.id;

    // Extract triggering PR info if available
    let triggeringPrNumber: number | undefined;
    if (
      payload.workflow_run?.pull_requests &&
      payload.workflow_run.pull_requests.length > 0
    ) {
      // Take the first PR if multiple are associated
      triggeringPrNumber = payload.workflow_run.pull_requests[0]?.number;
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
      name: payload.workflow_run.name || undefined,
      event: payload.workflow_run.event,
      status,
      conclusion,
      headBranch: payload.workflow_run.head_branch || undefined,
      headSha: payload.workflow_run.head_sha || undefined,
      htmlUrl: payload.workflow_run.html_url || undefined,
      createdAt,
      updatedAt,
      runStartedAt,
      runCompletedAt,
      runDuration,
      actorLogin,
      actorId,
      triggeringPrNumber,
    };

    console.log("[upsertWorkflowRun] Prepared document", {
      runId,
      runNumber,
      workflowId,
      workflowName,
      status,
      conclusion,
      triggeringPrNumber,
      teamId,
      repoFullName,
    });

    // Upsert the workflow run
    await ctx.db
      .query("githubWorkflowRuns")
      .withIndex("by_runId")
      .filter((q) => q.eq(q.field("runId"), runId))
      .unique()
      .then(async (existing) => {
        if (existing) {
          // Update existing run
          await ctx.db.patch(existing._id, {
            ...workflowRunDoc,
            _id: existing._id,
          });
          console.log("[upsertWorkflowRun] Updated workflow run", {
            _id: existing._id,
            runId,
            repoFullName,
            runNumber,
            status,
            conclusion,
            triggeringPrNumber,
          });
        } else {
          // Insert new run
          const newId = await ctx.db.insert("githubWorkflowRuns", workflowRunDoc);
          console.log("[upsertWorkflowRun] Inserted workflow run", {
            _id: newId,
            runId,
            repoFullName,
            runNumber,
            status,
            conclusion,
            triggeringPrNumber,
          });
        }
      });
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

    console.log("[getWorkflowRunsForPr] Query started", {
      teamSlugOrId,
      teamId,
      repoFullName,
      prNumber,
      headSha,
      limit,
    });

    const allRunsForRepo = await ctx.db
      .query("githubWorkflowRuns")
      .withIndex("by_team_repo", (q) =>
        q.eq("teamId", teamId).eq("repoFullName", repoFullName),
      )
      .collect();

    console.log("[getWorkflowRunsForPr] All runs for repo", {
      teamId,
      repoFullName,
      totalRuns: allRunsForRepo.length,
      prNumbers: allRunsForRepo.map((r) => r.triggeringPrNumber),
      headShas: allRunsForRepo.map((r) => r.headSha),
    });

    // Filter by either triggeringPrNumber or headSha
    const runs = allRunsForRepo
      .filter((run) => {
        const matchesPrNumber = run.triggeringPrNumber === prNumber;
        const matchesHeadSha = headSha && run.headSha === headSha;
        return matchesPrNumber || matchesHeadSha;
      })
      .sort((a, b) => (b.runStartedAt ?? 0) - (a.runStartedAt ?? 0))
      .slice(0, limit);

    console.log("[getWorkflowRunsForPr] Filtered runs for PR", {
      teamId,
      repoFullName,
      prNumber,
      headSha,
      foundRuns: runs.length,
      runs: runs.map((r) => ({
        runId: r.runId,
        workflowName: r.workflowName,
        status: r.status,
        conclusion: r.conclusion,
        triggeringPrNumber: r.triggeringPrNumber,
        headSha: r.headSha,
      })),
    });

    return runs;
  },
});

// Mutation to upsert workflow runs from API (not webhook)
export const upsertWorkflowRunsFromApi = authMutation({
  args: {
    teamSlugOrId: v.string(),
    repoFullName: v.string(),
    installationId: v.number(),
    repositoryId: v.optional(v.number()),
    workflowRuns: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const { teamSlugOrId, repoFullName, installationId, repositoryId, workflowRuns } = args;
    const teamId = await getTeamId(ctx, teamSlugOrId);

    console.log("[upsertWorkflowRunsFromApi] Upserting workflow runs", {
      teamSlugOrId,
      teamId,
      repoFullName,
      count: workflowRuns.length,
    });

    for (const workflowRun of workflowRuns) {
      const runId = workflowRun.id;
      const runNumber = workflowRun.run_number;
      const workflowId = workflowRun.workflow_id;
      const workflowName = workflowRun.name;

      if (!runId || !runNumber || !workflowId) {
        console.warn("[upsertWorkflowRunsFromApi] Missing required fields", {
          runId,
          runNumber,
          workflowId,
        });
        continue;
      }

      const githubStatus = workflowRun.status;
      const status = githubStatus === "requested" ? undefined : githubStatus;

      const githubConclusion = workflowRun.conclusion;
      const conclusion =
        githubConclusion === "stale" || githubConclusion === null
          ? undefined
          : githubConclusion;

      const createdAt = normalizeTimestamp(workflowRun.created_at);
      const updatedAt = normalizeTimestamp(workflowRun.updated_at);
      const runStartedAt = normalizeTimestamp(workflowRun.run_started_at);

      let runCompletedAt: number | undefined;
      if (workflowRun.status === "completed") {
        runCompletedAt = normalizeTimestamp(workflowRun.updated_at);
      }

      let runDuration: number | undefined;
      if (runStartedAt && runCompletedAt) {
        runDuration = Math.round((runCompletedAt - runStartedAt) / 1000);
      }

      const actorLogin = workflowRun.actor?.login;
      const actorId = workflowRun.actor?.id;

      let triggeringPrNumber: number | undefined;
      if (workflowRun.pull_requests && workflowRun.pull_requests.length > 0) {
        triggeringPrNumber = workflowRun.pull_requests[0]?.number;
      }

      const workflowRunDoc = {
        provider: "github" as const,
        installationId,
        repositoryId: repositoryId || 0,
        repoFullName,
        runId,
        runNumber,
        teamId,
        workflowId,
        workflowName: workflowName || workflowRun.workflow?.name || "",
        name: workflowRun.name || undefined,
        event: workflowRun.event,
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

      const existing = await ctx.db
        .query("githubWorkflowRuns")
        .withIndex("by_runId")
        .filter((q) => q.eq(q.field("runId"), runId))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, workflowRunDoc);
      } else {
        await ctx.db.insert("githubWorkflowRuns", workflowRunDoc);
      }
    }

    return { success: true, count: workflowRuns.length };
  },
});

// Mutation to manually trigger a backfill of workflow runs (for existing repos)
export const backfillWorkflowRuns = authMutation({
  args: {
    teamSlugOrId: v.string(),
    repoFullName: v.string(),
    workflowId: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { teamSlugOrId, repoFullName, workflowId } = args;
    const teamId = await getTeamId(ctx, teamSlugOrId);

    // This would typically call the GitHub API to fetch historical workflow runs
    // For now, we'll just return a success message
    // In a real implementation, you'd use the GitHub API client to fetch runs

    console.log("Workflow runs backfill requested", {
      teamSlugOrId,
      teamId,
      repoFullName,
      workflowId,
    });

    return {
      success: true,
      message:
        "Workflow runs backfill initiated. This would fetch historical runs from GitHub API.",
    };
  },
});
