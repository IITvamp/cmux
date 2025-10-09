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
    payload: v.object({
      check_run: v.optional(v.object({
        id: v.optional(v.number()),
        name: v.optional(v.string()),
        head_sha: v.optional(v.string()),
        status: v.optional(v.string()),
        conclusion: v.optional(v.union(v.string(), v.null())),
        updated_at: v.optional(v.union(v.string(), v.null())),
        started_at: v.optional(v.union(v.string(), v.null())),
        completed_at: v.optional(v.union(v.string(), v.null())),
        html_url: v.optional(v.string()),
        app: v.optional(v.object({
          id: v.optional(v.number()),
          slug: v.optional(v.string()),
          node_id: v.optional(v.string()),
          owner: v.optional(v.object({
            login: v.optional(v.string()),
            id: v.optional(v.number()),
            node_id: v.optional(v.string()),
            avatar_url: v.optional(v.string()),
            gravatar_id: v.optional(v.string()),
            url: v.optional(v.string()),
            html_url: v.optional(v.string()),
            followers_url: v.optional(v.string()),
            following_url: v.optional(v.string()),
            gists_url: v.optional(v.string()),
            starred_url: v.optional(v.string()),
            subscriptions_url: v.optional(v.string()),
            organizations_url: v.optional(v.string()),
            repos_url: v.optional(v.string()),
            events_url: v.optional(v.string()),
            received_events_url: v.optional(v.string()),
            type: v.optional(v.string()),
            site_admin: v.optional(v.boolean()),
            user_view_type: v.optional(v.string()),
          })),
          name: v.optional(v.string()),
          description: v.optional(v.union(v.string(), v.null())),
          external_url: v.optional(v.union(v.string(), v.null())),
          html_url: v.optional(v.string()),
          created_at: v.optional(v.string()),
          updated_at: v.optional(v.string()),
          permissions: v.optional(v.object({
            actions: v.optional(v.string()),
            administration: v.optional(v.string()),
            checks: v.optional(v.string()),
            contents: v.optional(v.string()),
            deployments: v.optional(v.string()),
            emails: v.optional(v.string()),
            issues: v.optional(v.string()),
            members: v.optional(v.string()),
            metadata: v.optional(v.string()),
            organization_hooks: v.optional(v.string()),
            pull_requests: v.optional(v.string()),
            repository_hooks: v.optional(v.string()),
            statuses: v.optional(v.string()),
          })),
          events: v.optional(v.array(v.string())),
          client_id: v.optional(v.string()),
        })),
        pull_requests: v.optional(v.array(v.object({
          id: v.optional(v.number()),
          number: v.optional(v.number()),
          url: v.optional(v.string()),
          head: v.optional(v.object({
            ref: v.optional(v.string()),
            sha: v.optional(v.string()),
            repo: v.optional(v.object({
              id: v.optional(v.number()),
              name: v.optional(v.string()),
              url: v.optional(v.string()),
            })),
          })),
          base: v.optional(v.object({
            ref: v.optional(v.string()),
            sha: v.optional(v.string()),
            repo: v.optional(v.object({
              id: v.optional(v.number()),
              name: v.optional(v.string()),
              url: v.optional(v.string()),
            })),
          })),
        }))),
      })),
      repository: v.optional(v.object({
        id: v.optional(v.number()),
        node_id: v.optional(v.string()),
        name: v.optional(v.string()),
        full_name: v.optional(v.string()),
        private: v.optional(v.boolean()),
        owner: v.optional(v.object({
          login: v.optional(v.string()),
          id: v.optional(v.number()),
          node_id: v.optional(v.string()),
          avatar_url: v.optional(v.string()),
          gravatar_id: v.optional(v.string()),
          url: v.optional(v.string()),
          html_url: v.optional(v.string()),
          followers_url: v.optional(v.string()),
          following_url: v.optional(v.string()),
          gists_url: v.optional(v.string()),
          starred_url: v.optional(v.string()),
          subscriptions_url: v.optional(v.string()),
          organizations_url: v.optional(v.string()),
          repos_url: v.optional(v.string()),
          events_url: v.optional(v.string()),
          received_events_url: v.optional(v.string()),
          type: v.optional(v.string()),
          site_admin: v.optional(v.boolean()),
          user_view_type: v.optional(v.string()),
        })),
        html_url: v.optional(v.string()),
        description: v.optional(v.union(v.string(), v.null())),
        fork: v.optional(v.boolean()),
        url: v.optional(v.string()),
        archive_url: v.optional(v.string()),
        assignees_url: v.optional(v.string()),
        blobs_url: v.optional(v.string()),
        branches_url: v.optional(v.string()),
        collaborators_url: v.optional(v.string()),
        comments_url: v.optional(v.string()),
        commits_url: v.optional(v.string()),
        compare_url: v.optional(v.string()),
        contents_url: v.optional(v.string()),
        contributors_url: v.optional(v.string()),
        deployments_url: v.optional(v.string()),
        downloads_url: v.optional(v.string()),
        events_url: v.optional(v.string()),
        forks_url: v.optional(v.string()),
        git_commits_url: v.optional(v.string()),
        git_refs_url: v.optional(v.string()),
        git_tags_url: v.optional(v.string()),
        git_url: v.optional(v.string()),
        issue_comment_url: v.optional(v.string()),
        issue_events_url: v.optional(v.string()),
        issues_url: v.optional(v.string()),
        keys_url: v.optional(v.string()),
        labels_url: v.optional(v.string()),
        languages_url: v.optional(v.string()),
        merges_url: v.optional(v.string()),
        milestones_url: v.optional(v.string()),
        notifications_url: v.optional(v.string()),
        pulls_url: v.optional(v.string()),
        releases_url: v.optional(v.string()),
        ssh_url: v.optional(v.string()),
        stargazers_url: v.optional(v.string()),
        statuses_url: v.optional(v.string()),
        subscribers_url: v.optional(v.string()),
        subscription_url: v.optional(v.string()),
        tags_url: v.optional(v.string()),
        teams_url: v.optional(v.string()),
        trees_url: v.optional(v.string()),
        clone_url: v.optional(v.string()),
        mirror_url: v.optional(v.union(v.string(), v.null())),
        hooks_url: v.optional(v.string()),
        svn_url: v.optional(v.string()),
        homepage: v.optional(v.union(v.string(), v.null())),
        language: v.optional(v.union(v.string(), v.null())),
        forks_count: v.optional(v.number()),
        stargazers_count: v.optional(v.number()),
        watchers_count: v.optional(v.number()),
        size: v.optional(v.number()),
        default_branch: v.optional(v.string()),
        open_issues_count: v.optional(v.number()),
        is_template: v.optional(v.boolean()),
        topics: v.optional(v.array(v.string())),
        has_issues: v.optional(v.boolean()),
        has_projects: v.optional(v.boolean()),
        has_wiki: v.optional(v.boolean()),
        has_pages: v.optional(v.boolean()),
        has_downloads: v.optional(v.boolean()),
        has_discussions: v.optional(v.boolean()),
        archived: v.optional(v.boolean()),
        disabled: v.optional(v.boolean()),
        visibility: v.optional(v.string()),
        pushed_at: v.optional(v.union(v.string(), v.number(), v.null())),
        created_at: v.optional(v.union(v.string(), v.number(), v.null())),
        updated_at: v.optional(v.union(v.string(), v.number(), v.null())),
        permissions: v.optional(v.object({
          admin: v.optional(v.boolean()),
          maintain: v.optional(v.boolean()),
          push: v.optional(v.boolean()),
          triage: v.optional(v.boolean()),
          pull: v.optional(v.boolean()),
        })),
        allow_rebase_merge: v.optional(v.boolean()),
        template_repository: v.optional(v.null()),
        temp_clone_token: v.optional(v.union(v.string(), v.null())),
        allow_squash_merge: v.optional(v.boolean()),
        allow_auto_merge: v.optional(v.boolean()),
        delete_branch_on_merge: v.optional(v.boolean()),
        allow_merge_commit: v.optional(v.boolean()),
        subscribers_count: v.optional(v.number()),
        network_count: v.optional(v.number()),
        license: v.optional(v.union(v.object({
          key: v.optional(v.string()),
          name: v.optional(v.string()),
          spdx_id: v.optional(v.union(v.string(), v.null())),
          url: v.optional(v.union(v.string(), v.null())),
          node_id: v.optional(v.string()),
        }), v.null())),
        forks: v.optional(v.number()),
        open_issues: v.optional(v.number()),
        watchers: v.optional(v.number()),
        allow_forking: v.optional(v.boolean()),
        web_commit_signoff_required: v.optional(v.boolean()),
        security_and_analysis: v.optional(v.union(v.object({
          advanced_security: v.optional(v.object({ status: v.optional(v.string()) })),
          secret_scanning: v.optional(v.object({ status: v.optional(v.string()) })),
          secret_scanning_push_protection: v.optional(v.object({ status: v.optional(v.string()) })),
        }), v.null())),
      })),
    }),
  },
  handler: async (ctx, args) => {
    const payload = args.payload as CheckRunEvent;
    const { installationId, repoFullName, teamId } = args;


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

    const updatedAt = normalizeTimestamp((payload.check_run as { updated_at?: string | null })?.updated_at);
    const startedAt = normalizeTimestamp((payload.check_run as { started_at?: string | null })?.started_at);
    const completedAt = normalizeTimestamp((payload.check_run as { completed_at?: string | null })?.completed_at);

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
