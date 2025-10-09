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

const timestampValue = v.union(v.string(), v.number());

export type CheckRunWebhookPayload = {
  checkRunId?: number;
  name?: string;
  headSha?: string;
  status?: string;
  conclusion?: string;
  repositoryId?: number;
  htmlUrl?: string;
  appName?: string;
  appSlug?: string;
  updatedAt?: string | number;
  startedAt?: string | number;
  completedAt?: string | number;
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

export const upsertCheckRunFromWebhook = internalMutation({
  args: {
    installationId: v.number(),
    repoFullName: v.string(),
    teamId: v.string(),
    payload: v.object({
      checkRunId: v.optional(v.number()),
      name: v.optional(v.string()),
      headSha: v.optional(v.string()),
      status: v.optional(v.string()),
      conclusion: v.optional(v.string()),
      repositoryId: v.optional(v.number()),
      htmlUrl: v.optional(v.string()),
      appName: v.optional(v.string()),
      appSlug: v.optional(v.string()),
      updatedAt: v.optional(timestampValue),
      startedAt: v.optional(timestampValue),
      completedAt: v.optional(timestampValue),
      pullRequestNumbers: v.optional(v.array(v.number())),
    }),
  },
  handler: async (ctx, args) => {
    const { installationId, repoFullName, teamId, payload } = args;


    // Extract core check run data
    const checkRunId = payload.checkRunId;
    const name = payload.name;
    const headSha = payload.headSha;

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

    const githubStatus = payload.status;
    const validStatuses = ["queued", "in_progress", "completed", "pending", "waiting"] as const;
    type ValidStatus = typeof validStatuses[number];
    const status = githubStatus && validStatuses.includes(githubStatus as ValidStatus) ? githubStatus : undefined;

    // Map GitHub conclusion to our schema conclusion
    const githubConclusion = payload.conclusion;
    const conclusion =
      githubConclusion === "stale"
        ? undefined
        : githubConclusion;

    const updatedAt = normalizeTimestamp(payload.updatedAt);
    const startedAt = normalizeTimestamp(payload.startedAt);
    const completedAt = normalizeTimestamp(payload.completedAt);

    // Extract app info
    const appName = payload.appName;
    const appSlug = payload.appSlug;

    // Extract URLs
    const htmlUrl = payload.htmlUrl;

    // Extract triggering PR info if available
    let triggeringPrNumber: number | undefined;
    if (payload.pullRequestNumbers && payload.pullRequestNumbers.length > 0) {
      // Take the first PR if multiple are associated
      triggeringPrNumber = payload.pullRequestNumbers[0];
    }

    // Prepare the document
    const checkRunDoc = {
      provider: "github" as const,
      installationId,
      repositoryId: payload.repositoryId,
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


    // Upsert the check run - fetch all matching records to handle duplicates
    const existingRecords = await ctx.db
      .query("githubCheckRuns")
      .withIndex("by_checkRunId", (q) => q.eq("checkRunId", checkRunId))
      .collect();

    if (existingRecords.length > 0) {
      // Update the first record
      await ctx.db.patch(existingRecords[0]._id, checkRunDoc);

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
      await ctx.db.insert("githubCheckRuns", checkRunDoc);
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


    // Source: check_run webhooks from third-party GitHub Apps (e.g., Vercel, Bugbot)
    const allRunsForRepo = await ctx.db
      .query("githubCheckRuns")
      .withIndex("by_team_repo", (q) =>
        q.eq("teamId", teamId).eq("repoFullName", repoFullName),
      )
      .collect();


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


    return runs;
  },
});
