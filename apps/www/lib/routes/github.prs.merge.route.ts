import { getAccessTokenFromRequest } from "@/lib/utils/auth";
import { env } from "@/lib/utils/www-env";
import { api } from "@cmux/convex/api";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";
import { getConvex } from "../utils/get-convex";
import { githubPrivateKey } from "../utils/githubPrivateKey";

export const githubPrsMergeRouter = new OpenAPIHono();

const Body = z
  .object({
    team: z.string().min(1).openapi({ description: "Team slug or UUID" }),
    owner: z.string().min(1).openapi({ description: "Repository owner" }),
    repo: z.string().min(1).openapi({ description: "Repository name" }),
    number: z.coerce
      .number()
      .min(1)
      .openapi({ description: "Pull request number" }),
    method: z
      .enum(["squash", "rebase", "merge"])
      .default("squash")
      .optional()
      .openapi({ description: "Merge method (default squash)" }),
  })
  .openapi("GithubPrsMergeBody");

const MergeResponse = z
  .object({
    merged: z.boolean(),
    url: z.string().optional(),
    message: z.string().optional(),
    state: z.enum(["open", "closed", "merged"]).optional(),
  })
  .openapi("GithubPrsMergeResponse");

githubPrsMergeRouter.openapi(
  createRoute({
    method: "post" as const,
    path: "/integrations/github/prs/merge",
    tags: ["Integrations"],
    summary: "Merge a GitHub pull request for a team installation",
    request: {
      body: {
        content: {
          "application/json": { schema: Body },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "OK",
        content: { "application/json": { schema: MergeResponse } },
      },
      400: { description: "Bad request" },
      401: { description: "Unauthorized" },
      404: { description: "Installation or PR not found" },
      501: { description: "Not configured" },
    },
  }),
  async (c) => {
    const accessToken = await getAccessTokenFromRequest(c.req.raw);
    if (!accessToken) return c.text("Unauthorized", 401);

    const { team, owner, repo, number, method = "squash" } = c.req.valid("json");

    // Fetch provider connections for this team via Convex
    const convex = getConvex({ accessToken });
    const connections = await convex.query(api.github.listProviderConnections, {
      teamSlugOrId: team,
    });

    type Conn = {
      installationId: number;
      isActive?: boolean | null;
      accountLogin?: string | null;
      accountType?: "Organization" | "User" | null;
    };

    const target = (connections as Conn[]).find(
      (co) => co.isActive !== false && (co.accountLogin ?? "").toLowerCase() === owner.toLowerCase()
    );
    if (!target) return c.text("Installation not found for owner", 404);

    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: env.CMUX_GITHUB_APP_ID,
        privateKey: githubPrivateKey,
        installationId: target.installationId,
      },
    });

    try {
      // Get PR details first (for node id and state/draft)
      const prRes = await octokit.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}",
        {
          owner,
          repo,
          pull_number: number,
        }
      );
      const pr = prRes.data as unknown as {
        number: number;
        html_url?: string;
        state?: string;
        draft?: boolean;
        node_id?: string;
        title?: string;
      };

      if (!pr) return c.text("PR not found", 404);

      // If draft, mark ready via GraphQL
      if (pr.draft) {
        const mutation = `
          mutation($pullRequestId: ID!) {
            markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
              pullRequest { id isDraft }
            }
          }
        `;
        const id = pr.node_id;
        if (!id) return c.text("Missing PR node id", 400);
        try {
          await octokit.graphql(mutation, { pullRequestId: id });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return c.text(`PR is draft and could not be made ready: ${msg}`, 400);
        }
      }

      // If closed, try to reopen first
      if ((pr.state || "").toLowerCase() === "closed") {
        try {
          await octokit.rest.pulls.update({
            owner,
            repo,
            pull_number: number,
            state: "open",
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return c.text(`PR is closed and could not be reopened: ${msg}`, 400);
        }
      }

      // Merge the PR
      const mergeRes = await octokit.rest.pulls.merge({
        owner,
        repo,
        pull_number: number,
        merge_method: method,
        commit_title: pr.title && pr.title.length > 0 ? pr.title.slice(0, 72) : "Merged by cmux",
        commit_message: `Merged by cmux`,
      });

      // Best-effort: update our Convex record with merged status
      try {
        const ts = Date.now();
        await convex.mutation(api.github_prs.upsertFromServer, {
          teamSlugOrId: team,
          installationId: target.installationId,
          repoFullName: `${owner}/${repo}`,
          number,
          record: {
            title: pr.title || "",
            state: "closed",
            merged: true,
            mergedAt: ts,
            htmlUrl: pr.html_url,
          },
        });
      } catch {
        // ignore upsert errors
      }

      return c.json({
        merged: !!mergeRes.data.merged,
        url: pr.html_url,
        message: mergeRes.data.message,
        state: mergeRes.data.merged ? "merged" : undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.text(`Failed to merge PR: ${msg}`, 400);
    }
  }
);

export default githubPrsMergeRouter;

