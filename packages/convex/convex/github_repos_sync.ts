"use node";

import { v } from "convex/values";
import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";
import { env } from "../_shared/convex-env";
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Internal mutation to insert a batch of repositories into the database
 */
export const insertRepoBatch = internalMutation({
  args: {
    teamId: v.string(),
    userId: v.string(),
    repos: v.array(
      v.object({
        fullName: v.string(),
        name: v.string(),
        org: v.string(),
        gitRemote: v.string(),
        provider: v.string(),
        providerRepoId: v.optional(v.number()),
        ownerLogin: v.optional(v.string()),
        ownerType: v.optional(
          v.union(v.literal("User"), v.literal("Organization"))
        ),
        visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
        defaultBranch: v.optional(v.string()),
        lastPushedAt: v.optional(v.number()),
      })
    ),
    connectionId: v.id("providerConnections"),
  },
  handler: async (ctx, { teamId, userId, repos, connectionId }) => {
    // Get existing repos to avoid duplicates
    const existing = await ctx.db
      .query("repos")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .collect();

    const existingByProviderRepoId = new Map(
      existing
        .filter((r) => r.providerRepoId !== undefined)
        .map((r) => [r.providerRepoId, r] as const)
    );

    const now = Date.now();
    const inserted: string[] = [];
    const updated: string[] = [];

    for (const repo of repos) {
      if (repo.providerRepoId !== undefined) {
        const existingRepo = existingByProviderRepoId.get(repo.providerRepoId);
        if (existingRepo) {
          // Update existing repo
          await ctx.db.patch(existingRepo._id, {
            fullName: repo.fullName,
            name: repo.name,
            org: repo.org,
            gitRemote: repo.gitRemote,
            ownerLogin: repo.ownerLogin,
            ownerType: repo.ownerType,
            visibility: repo.visibility,
            defaultBranch: repo.defaultBranch,
            lastPushedAt: repo.lastPushedAt,
            lastSyncedAt: now,
            connectionId,
          });
          updated.push(existingRepo._id);
          continue;
        }
      }

      // Insert new repo
      const id = await ctx.db.insert("repos", {
        ...repo,
        userId,
        teamId,
        connectionId,
        lastSyncedAt: now,
      });
      inserted.push(id);
    }

    return { inserted: inserted.length, updated: updated.length };
  },
});

/**
 * Internal action to sync all repositories from a GitHub App installation
 * Fetches repositories via pagination and schedules background insertions
 */
export const syncInstallationRepositories = internalAction({
  args: {
    installationId: v.number(),
    teamId: v.string(),
    userId: v.string(),
    connectionId: v.id("providerConnections"),
  },
  handler: async (ctx, { installationId, teamId, userId, connectionId }) => {
    if (!env.CMUX_GITHUB_APP_ID) {
      throw new Error("CMUX_GITHUB_APP_ID not configured");
    }
    if (!env.GITHUB_APP_PRIVATE_KEY) {
      throw new Error("GITHUB_APP_PRIVATE_KEY not configured");
    }

    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: env.CMUX_GITHUB_APP_ID,
        privateKey: env.GITHUB_APP_PRIVATE_KEY,
        installationId,
      },
    });

    const BATCH_SIZE = 30; // Number of repos to insert per batch
    const PER_PAGE = 100; // GitHub API max per page
    let page = 1;
    let totalFetched = 0;
    let totalInserted = 0;
    let totalUpdated = 0;

    try {
      while (true) {
        // Fetch a page of repositories
        const response = await octokit.request(
          "GET /installation/repositories",
          {
            per_page: PER_PAGE,
            page,
          }
        );

        const repositories = response.data.repositories;
        if (repositories.length === 0) break;

        totalFetched += repositories.length;

        // Process repositories in batches
        const insertPromises: Promise<{ inserted: number; updated: number }>[] = [];

        for (let i = 0; i < repositories.length; i += BATCH_SIZE) {
          const batch = repositories.slice(i, i + BATCH_SIZE);

          const repoData = batch.map((repo) => {
            const [org, name] = repo.full_name.split("/");
            return {
              fullName: repo.full_name,
              name: repo.name,
              org: org ?? "",
              gitRemote: repo.clone_url,
              provider: "github",
              providerRepoId: repo.id,
              ownerLogin: repo.owner?.login,
              ownerType: repo.owner?.type === "Organization" ? "Organization" as const : "User" as const,
              visibility: repo.private ? "private" as const : "public" as const,
              defaultBranch: repo.default_branch,
              lastPushedAt: repo.pushed_at ? new Date(repo.pushed_at).getTime() : undefined,
            };
          });

          // Schedule insertion in background (non-blocking)
          const promise = ctx.runMutation(internal.github_repos_sync.insertRepoBatch, {
            teamId,
            userId,
            repos: repoData,
            connectionId,
          });
          insertPromises.push(promise);
        }

        // Don't block pagination on insertions, but track results
        Promise.all(insertPromises).then((results) => {
          for (const result of results) {
            totalInserted += result.inserted;
            totalUpdated += result.updated;
          }
        }).catch((err) => {
          console.error("Failed to insert repo batches:", err);
        });

        // Check if we've fetched all repositories
        if (repositories.length < PER_PAGE) break;
        page++;
      }

      console.log(
        `GitHub repo sync completed for installation ${installationId}: ` +
        `fetched ${totalFetched}, inserted ${totalInserted}, updated ${totalUpdated}`
      );

      return {
        success: true,
        fetched: totalFetched,
        inserted: totalInserted,
        updated: totalUpdated,
      };
    } catch (error) {
      console.error(
        `Failed to sync repositories for installation ${installationId}:`,
        error
      );
      throw error;
    }
  },
});
