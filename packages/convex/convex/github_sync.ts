"use node";

import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";
import { v } from "convex/values";
import { env } from "../_shared/convex-env";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Action to sync repositories from a GitHub App installation
export const syncRepositoriesFromInstallation = internalAction({
  args: {
    installationId: v.number(),
    connectionId: v.id("providerConnections"),
    teamId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { installationId, connectionId, teamId, userId }) => {
    if (!env.CMUX_GITHUB_APP_ID || !env.CMUX_GITHUB_APP_PRIVATE_KEY) {
      throw new Error("GitHub App credentials not configured");
    }

    // Replace escaped newlines with actual newlines
    const privateKey = env.CMUX_GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n");

    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: env.CMUX_GITHUB_APP_ID,
        privateKey,
        installationId,
      },
    });

    let totalSynced = 0;
    let page = 1;
    const perPage = 100;

    try {
      while (true) {
        const response = await octokit.request(
          "GET /installation/repositories",
          {
            per_page: perPage,
            page,
          }
        );

        const repos = response.data.repositories;

        // Trigger background insertions for this page concurrently
        // We await to ensure they complete, but run them in parallel
        const insertionPromises = repos.map((repo) => {
          const owner = repo.owner?.login ?? "";
          const [org] = repo.full_name?.split("/") ?? [owner];

          // Schedule mutation in background without blocking
          return ctx.scheduler.runAfter(0, internal.github.upsertRepoFromGitHubAPI, {
            teamId,
            userId,
            connectionId,
            fullName: repo.full_name,
            org,
            name: repo.name,
            providerRepoId: repo.id,
            ownerLogin: owner,
            ownerType:
              repo.owner?.type === "Organization" ? "Organization" : "User",
            visibility: repo.private ? "private" : "public",
            defaultBranch: repo.default_branch ?? undefined,
            lastPushedAt: repo.pushed_at
              ? new Date(repo.pushed_at).getTime()
              : undefined,
          });
        });

        // Wait for all mutations to be scheduled (but not to complete)
        await Promise.all(insertionPromises);

        totalSynced += repos.length;

        // Check if there are more pages
        if (repos.length < perPage) {
          break;
        }

        page++;
      }

      return { synced: totalSynced, installationId };
    } catch (error) {
      console.error(
        `Failed to sync repositories for installation ${installationId}:`,
        error instanceof Error ? error.message : error
      );
      throw error;
    }
  },
});
