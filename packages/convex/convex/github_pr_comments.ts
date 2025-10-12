"use node";
import { v } from "convex/values";
import { fetchInstallationAccessToken } from "../_shared/githubApp";
import { internalAction } from "./_generated/server";

/**
 * Posts a comment on a GitHub PR using the installation access token.
 * This is a Node.js action because it needs to make external API calls.
 */
export const postPrComment = internalAction({
  args: {
    installationId: v.number(),
    repoFullName: v.string(),
    prNumber: v.number(),
    body: v.string(),
  },
  handler: async (_ctx, { installationId, repoFullName, prNumber, body }) => {
    try {
      const accessToken = await fetchInstallationAccessToken(installationId);
      if (!accessToken) {
        console.error(
          "[github_pr_comments] Failed to get access token for installation",
          { installationId }
        );
        return { ok: false as const, error: "Failed to get access token" };
      }

      const response = await fetch(
        `https://api.github.com/repos/${repoFullName}/issues/${prNumber}/comments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "cmux-github-bot",
          },
          body: JSON.stringify({ body }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "[github_pr_comments] Failed to post comment",
          {
            installationId,
            repoFullName,
            prNumber,
            status: response.status,
            error: errorText,
          }
        );
        return {
          ok: false as const,
          error: `GitHub API error: ${response.status}`,
        };
      }

      const data = (await response.json()) as { id?: number; html_url?: string };
      console.log("[github_pr_comments] Successfully posted comment", {
        installationId,
        repoFullName,
        prNumber,
        commentId: data.id,
        commentUrl: data.html_url,
      });

      return { ok: true as const, commentId: data.id, url: data.html_url };
    } catch (error) {
      console.error(
        "[github_pr_comments] Unexpected error posting comment",
        {
          installationId,
          repoFullName,
          prNumber,
          error,
        }
      );
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
