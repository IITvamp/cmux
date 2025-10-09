/**
 * GitHub Check Runs
 *
 * Handles check_run webhooks from GitHub Checks API.
 * These are checks from third-party apps like Vercel, Bugbot, etc.
 *
 * NOT to be confused with:
 * - workflow_run events (see github_workflows.ts) - GitHub Actions workflows
 * - deployment events (see github_deployments.ts) - deployment records
 * - status events (see github_commit_statuses.ts) - legacy commit statuses
 */
import { v } from "convex/values";
import { getTeamId } from "../_shared/team";
import { internalMutation } from "./_generated/server";
import { authQuery } from "./users/utils";
import type { CheckRunEvent } from "@octokit/webhooks-types";

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

export const upsertCheckRunFromWebhook = internalMutation({
  args: {
    installationId: v.number(),
    repoFullName: v.string(),
    teamId: v.string(),
    payload: v.any(), // CheckRunEvent from webhook
  },
  handler: async (ctx, args) => {
    const payload = args.payload as CheckRunEvent;
    const { installationId, repoFullName, teamId } = args;

    console.log("[upsertCheckRun] Starting", {
      teamId,
      repoFullName,
      installationId,
      action: payload.action,
    });

    // Extract core check run data
    const checkRunId = payload.check_run?.id;
    const name = payload.check_run?.name;
    const headSha = payload.check_run?.head_sha;

    if (!checkRunId || !name || !headSha) {
      console.warn("[upsertCheckRun] Missing required fields", {
        checkRunId,
        name,
        headSha,
        repoFullName,
        teamId,
      });
      return;
    }

    const githubStatus = payload.check_run?.status;
    const validStatuses = ["queued", "in_progress", "completed", "pending", "waiting"] as const;
    type ValidStatus = typeof validStatuses[number];
    const status = githubStatus && validStatuses.includes(githubStatus as ValidStatus) ? githubStatus : undefined;

    // Map GitHub conclusion to our schema conclusion
    const githubConclusion = payload.check_run?.conclusion;
    const conclusion =
      githubConclusion === "stale" || githubConclusion === null
        ? undefined
        : githubConclusion;

    const updatedAt = normalizeTimestamp((payload.check_run as any)?.updated_at);
    const startedAt = normalizeTimestamp((payload.check_run as any)?.started_at);
    const completedAt = normalizeTimestamp((payload.check_run as any)?.completed_at);

    // Extract app info
    const appName = payload.check_run?.app?.name;
    const appSlug = payload.check_run?.app?.slug;

    // Extract URLs
    const htmlUrl = payload.check_run?.html_url;

    // Extract triggering PR info if available
    let triggeringPrNumber: number | undefined;
    if (
      payload.check_run?.pull_requests &&
      payload.check_run.pull_requests.length > 0
    ) {
      // Take the first PR if multiple are associated
      triggeringPrNumber = payload.check_run.pull_requests[0]?.number;
    }

    // Prepare the document
    const checkRunDoc = {
      provider: "github" as const,
      installationId,
      repositoryId: payload.repository?.id,
      repoFullName,
      checkRunId,
      teamId,
      name,
      status,
      conclusion,
      headSha,
      htmlUrl,
      updatedAt,
      startedAt,
      completedAt,
      appName,
      appSlug,
      triggeringPrNumber,
    };

    console.log("[upsertCheckRun] Prepared document", {
      checkRunId,
      name,
      status,
      conclusion,
      headSha,
      triggeringPrNumber,
      appName,
      teamId,
      repoFullName,
    });

    // Upsert the check run - fetch all matching records to handle duplicates
    const existingRecords = await ctx.db
      .query("githubCheckRuns")
      .withIndex("by_checkRunId", (q) => q.eq("checkRunId", checkRunId))
      .collect();

    if (existingRecords.length > 0) {
      // Update the first record
      await ctx.db.patch(existingRecords[0]._id, checkRunDoc);
      console.log("[upsertCheckRun] Updated check run", {
        _id: existingRecords[0]._id,
        checkRunId,
        repoFullName,
        name,
        status,
        conclusion,
        triggeringPrNumber,
      });

      // Delete any duplicates
      if (existingRecords.length > 1) {
        console.warn("[upsertCheckRun] Found duplicates, cleaning up", {
          checkRunId,
          count: existingRecords.length,
          duplicateIds: existingRecords.slice(1).map(r => r._id),
        });
        for (const duplicate of existingRecords.slice(1)) {
          await ctx.db.delete(duplicate._id);
        }
      }
    } else {
      // Insert new check run
      const newId = await ctx.db.insert("githubCheckRuns", checkRunDoc);
      console.log("[upsertCheckRun] Inserted check run", {
        _id: newId,
        checkRunId,
        repoFullName,
        name,
        status,
        conclusion,
        triggeringPrNumber,
      });
    }
  },
});

// Query to get check runs for a specific PR
export const getCheckRunsForPr = authQuery({
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

    console.log("[getCheckRunsForPr] Query started", {
      teamSlugOrId,
      teamId,
      repoFullName,
      prNumber,
      headSha,
      limit,
    });

    // Source: check_run webhooks from third-party GitHub Apps (e.g., Vercel, Bugbot)
    const allRunsForRepo = await ctx.db
      .query("githubCheckRuns")
      .withIndex("by_team_repo", (q) =>
        q.eq("teamId", teamId).eq("repoFullName", repoFullName),
      )
      .collect();

    console.log("[getCheckRunsForPr] All check runs for repo", {
      teamId,
      repoFullName,
      totalRuns: allRunsForRepo.length,
      prNumbers: allRunsForRepo.map((r) => r.triggeringPrNumber),
      headShas: allRunsForRepo.map((r) => r.headSha),
    });

    // Filter by headSha if provided (more specific), otherwise by triggeringPrNumber
    const filtered = allRunsForRepo.filter((run) => {
      if (headSha) {
        return run.headSha === headSha;
      }
      return run.triggeringPrNumber === prNumber;
    });

    // Deduplicate by name (for same app), keeping the most recently updated one
    const dedupMap = new Map<string, typeof filtered[number]>();
    for (const run of filtered) {
      const key = `${run.appSlug || run.appName || 'unknown'}-${run.name}`;
      const existing = dedupMap.get(key);
      if (!existing || (run.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
        dedupMap.set(key, run);
      }
    }

    const runs = Array.from(dedupMap.values())
      .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))
      .slice(0, limit);

    console.log("[getCheckRunsForPr] Filtered check runs for PR", {
      teamId,
      repoFullName,
      prNumber,
      headSha,
      foundRuns: runs.length,
      runs: runs.map((r) => ({
        checkRunId: r.checkRunId,
        name: r.name,
        status: r.status,
        conclusion: r.conclusion,
        triggeringPrNumber: r.triggeringPrNumber,
        headSha: r.headSha,
        appName: r.appName,
      })),
    });

    return runs;
  },
});
