"use node";

import type { Endpoints } from "@octokit/types";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";
import { v } from "convex/values";
import { env } from "../_shared/convex-env";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";

type ListReposResponse =
  Endpoints["GET /installation/repositories"]["response"]["data"];

/**
 * Paginate through all repositories for a given installation and insert them into the database.
 * This runs in the background without blocking the webhook response.
 */
export const syncRepositoriesForInstallation = internalAction({
  args: {
    installationId: v.number(),
    teamId: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, { installationId, teamId, userId }) => {
    if (!env.CMUX_GITHUB_APP_ID) {
      throw new Error("CMUX_GITHUB_APP_ID not configured");
    }
    if (!env.CMUX_GITHUB_PRIVATE_KEY) {
      throw new Error("CMUX_GITHUB_PRIVATE_KEY not configured");
    }

    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: env.CMUX_GITHUB_APP_ID,
        privateKey: env.CMUX_GITHUB_PRIVATE_KEY.replace(/\\n/g, "\n"),
        installationId,
      },
    });

    let page = 1;
    let hasMore = true;
    let totalSynced = 0;

    while (hasMore) {
      try {
        const response = await octokit.request(
          "GET /installation/repositories",
          {
            per_page: 100,
            page,
          }
        );

        const data = response.data as ListReposResponse;
        const repos = data.repositories || [];

        if (repos.length === 0) {
          hasMore = false;
          break;
        }

        // Kick off insertion in the background (non-blocking)
        // We use scheduler.runAfter with 0ms to queue it immediately but not block pagination
        const reposToInsert = repos.map((repo) => ({
          fullName: repo.full_name,
          org: repo.owner.login,
          name: repo.name,
          gitRemote: repo.clone_url,
          provider: "github" as const,
          providerRepoId: repo.id,
          ownerLogin: repo.owner.login,
          ownerType: repo.owner.type === "Organization" ? ("Organization" as const) : ("User" as const),
          visibility: repo.private ? ("private" as const) : ("public" as const),
          defaultBranch: repo.default_branch,
        }));

        // Schedule the insertion to run immediately but don't block
        await ctx.scheduler.runAfter(0, internal.github_repos.insertRepositoriesBatch, {
          teamId,
          userId,
          installationId,
          repos: reposToInsert,
        });

        totalSynced += repos.length;

        // Check if there are more pages
        hasMore = repos.length === 100;
        page++;
      } catch (err) {
        console.error(
          `Failed to sync repositories for installation ${installationId}, page ${page}:`,
          err instanceof Error ? err.message : err
        );
        // Continue to next page even if one fails
        hasMore = false;
      }
    }

    console.log(
      `Repository sync completed for installation ${installationId}: ${totalSynced} repos queued`
    );

    return { totalSynced };
  },
});

/**
 * Insert a batch of repositories into the database.
 * This mutation is called by the action above and handles upserts.
 */
export const insertRepositoriesBatch = internalMutation({
  args: {
    teamId: v.string(),
    userId: v.optional(v.string()),
    installationId: v.number(),
    repos: v.array(
      v.object({
        fullName: v.string(),
        org: v.string(),
        name: v.string(),
        gitRemote: v.string(),
        provider: v.string(),
        providerRepoId: v.optional(v.number()),
        ownerLogin: v.optional(v.string()),
        ownerType: v.optional(
          v.union(v.literal("User"), v.literal("Organization"))
        ),
        visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
        defaultBranch: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { teamId, userId, installationId, repos }) => {
    const now = Date.now();

    // Find the connection for this installation
    const connection = await ctx.db
      .query("providerConnections")
      .withIndex("by_installationId", (q) =>
        q.eq("installationId", installationId)
      )
      .first();

    if (!connection) {
      console.error(`No provider connection found for installation ${installationId}`);
      return { inserted: 0, updated: 0 };
    }

    // If userId is not provided, use the connectedByUserId from the connection
    const effectiveUserId = userId || connection.connectedByUserId;
    if (!effectiveUserId) {
      console.error(`No userId available for installation ${installationId}`);
      return { inserted: 0, updated: 0 };
    }

    let inserted = 0;
    let updated = 0;

    for (const repo of repos) {
      try {
        // Check if repo already exists by team + providerRepoId
        const existing = repo.providerRepoId
          ? await ctx.db
              .query("repos")
              .withIndex("by_providerRepoId", (q) =>
                q.eq("teamId", teamId).eq("providerRepoId", repo.providerRepoId)
              )
              .first()
          : null;

        if (existing) {
          // Update existing repo
          await ctx.db.patch(existing._id, {
            fullName: repo.fullName,
            org: repo.org,
            name: repo.name,
            gitRemote: repo.gitRemote,
            provider: repo.provider,
            providerRepoId: repo.providerRepoId,
            ownerLogin: repo.ownerLogin,
            ownerType: repo.ownerType,
            visibility: repo.visibility,
            defaultBranch: repo.defaultBranch,
            connectionId: connection._id,
            lastSyncedAt: now,
          });
          updated++;
        } else {
          // Insert new repo
          await ctx.db.insert("repos", {
            fullName: repo.fullName,
            org: repo.org,
            name: repo.name,
            gitRemote: repo.gitRemote,
            provider: repo.provider,
            providerRepoId: repo.providerRepoId,
            ownerLogin: repo.ownerLogin,
            ownerType: repo.ownerType,
            visibility: repo.visibility,
            defaultBranch: repo.defaultBranch,
            userId: effectiveUserId,
            teamId,
            connectionId: connection._id,
            lastSyncedAt: now,
          });
          inserted++;
        }
      } catch (err) {
        console.error(
          `Failed to insert/update repo ${repo.fullName}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    console.log(
      `Batch insert completed for installation ${installationId}: ${inserted} inserted, ${updated} updated`
    );

    return { inserted, updated };
  },
});
