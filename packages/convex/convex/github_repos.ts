"use node";

import { v } from "convex/values";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";
import { env } from "../_shared/convex-env";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";

/**
 * Background mutation to insert a batch of repos.
 * Checks for existing repos by fullName to avoid duplicates.
 */
export const insertReposBatch = internalMutation({
  args: {
    teamId: v.string(),
    userId: v.string(),
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
        lastPushedAt: v.optional(v.number()),
      })
    ),
    connectionId: v.id("providerConnections"),
  },
  handler: async (ctx, { teamId, userId, repos, connectionId }) => {
    const now = Date.now();

    // Fetch existing repos for this team to check duplicates
    const existingRepos = await ctx.db
      .query("repos")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .collect();

    const existingByFullName = new Map(
      existingRepos.map((r) => [r.fullName, r])
    );

    const inserted: string[] = [];
    const updated: string[] = [];

    for (const repo of repos) {
      const existing = existingByFullName.get(repo.fullName);

      if (existing) {
        // Update existing repo with new metadata
        await ctx.db.patch(existing._id, {
          providerRepoId: repo.providerRepoId ?? existing.providerRepoId,
          ownerLogin: repo.ownerLogin ?? existing.ownerLogin,
          ownerType: repo.ownerType ?? existing.ownerType,
          visibility: repo.visibility ?? existing.visibility,
          defaultBranch: repo.defaultBranch ?? existing.defaultBranch,
          lastPushedAt: repo.lastPushedAt ?? existing.lastPushedAt,
          lastSyncedAt: now,
          connectionId,
        });
        updated.push(repo.fullName);
      } else {
        // Insert new repo
        await ctx.db.insert("repos", {
          ...repo,
          userId,
          teamId,
          lastSyncedAt: now,
          connectionId,
        });
        inserted.push(repo.fullName);
      }
    }

    return { inserted: inserted.length, updated: updated.length };
  },
});

/**
 * Action to paginate through all repositories for an installation
 * and stream them into the database in batches.
 */
export const syncRepositoriesForInstallation = internalAction({
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

    // Get the GitHub App private key from environment
    const privateKeyEnv = env.CMUX_GITHUB_APP_PRIVATE_KEY;
    if (!privateKeyEnv) {
      throw new Error("CMUX_GITHUB_APP_PRIVATE_KEY not configured");
    }

    // Decode the private key (it might be base64 encoded)
    const privateKey = privateKeyEnv.includes("BEGIN")
      ? privateKeyEnv
      : Buffer.from(privateKeyEnv, "base64").toString("utf8");

    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: env.CMUX_GITHUB_APP_ID,
        privateKey,
        installationId,
      },
    });

    let page = 1;
    let totalInserted = 0;
    let totalUpdated = 0;
    const batchSize = 20; // Insert in batches of 20 repos

    try {
      while (true) {
        // Fetch a page of repositories
        const response = await octokit.request(
          "GET /installation/repositories",
          {
            per_page: 100,
            page,
          }
        );

        const repositories = response.data.repositories;

        if (!repositories || repositories.length === 0) {
          break; // No more repos
        }

        // Process repos in batches
        for (let i = 0; i < repositories.length; i += batchSize) {
          const batch = repositories.slice(i, i + batchSize);

          const repoRecords = batch.map((repo) => {
            const [org, name] = repo.full_name.split("/");
            return {
              fullName: repo.full_name,
              org,
              name,
              gitRemote: repo.clone_url || `https://github.com/${repo.full_name}.git`,
              provider: "github",
              providerRepoId: repo.id,
              ownerLogin: repo.owner?.login,
              ownerType:
                repo.owner?.type === "Organization"
                  ? "Organization" as const
                  : "User" as const,
              visibility: repo.private ? ("private" as const) : ("public" as const),
              defaultBranch: repo.default_branch,
              lastPushedAt: repo.pushed_at ? Date.parse(repo.pushed_at) : undefined,
            };
          });

          // Insert this batch in the background (non-blocking)
          const result = await ctx.runMutation(
            internal.github_repos.insertReposBatch,
            {
              teamId,
              userId,
              repos: repoRecords,
              connectionId,
            }
          );

          totalInserted += result.inserted;
          totalUpdated += result.updated;
        }

        // Check if there are more pages
        if (repositories.length < 100) {
          break; // Last page
        }

        page++;
      }

      return {
        success: true,
        totalInserted,
        totalUpdated,
        totalProcessed: totalInserted + totalUpdated,
      };
    } catch (error) {
      console.error("Failed to sync repositories:", error);
      throw error;
    }
  },
});
