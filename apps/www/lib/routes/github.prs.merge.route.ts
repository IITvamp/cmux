import { getAccessTokenFromRequest } from "@/lib/utils/auth";
import { env } from "@/lib/utils/www-env";
import { api } from "@cmux/convex/api";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";
import { getConvex } from "../utils/get-convex";
import { githubPrivateKey } from "../utils/githubPrivateKey";

export const githubPrsMergeRouter = new OpenAPIHono();

const Query = z
  .object({
    team: z.string().min(1).openapi({ description: "Team slug or UUID" }),
    owner: z.string().min(1).openapi({ description: "GitHub owner/org" }),
    repo: z.string().min(1).openapi({ description: "GitHub repo name" }),
    number: z.coerce.number().min(1).openapi({ description: "PR number" }),
  })
  .openapi("GithubPrsMergeQuery");

const Body = z
  .object({
    method: z
      .enum(["squash", "rebase", "merge"]) // GitHub merge_method values
      .default("squash")
      .openapi({ description: "Merge method (default squash)" }),
    commit_title: z
      .string()
      .optional()
      .openapi({ description: "Optional merge commit title" }),
    commit_message: z
      .string()
      .optional()
      .openapi({ description: "Optional merge commit message" }),
  })
  .openapi("GithubPrsMergeBody");

const Response = z
  .object({
    success: z.boolean(),
    merged: z.boolean().optional(),
    sha: z.string().optional(),
    url: z.string().optional(),
    error: z.string().optional(),
  })
  .openapi("GithubPrsMergeResponse");

githubPrsMergeRouter.openapi(
  createRoute({
    method: "post" as const,
    path: "/integrations/github/prs/merge",
    tags: ["Integrations"],
    summary: "Merge a GitHub pull request via GitHub App installation",
    request: { query: Query, body: { content: { "application/json": { schema: Body } } } },
    responses: {
      200: { description: "OK", content: { "application/json": { schema: Response } } },
      401: { description: "Unauthorized" },
      404: { description: "Not found" },
    },
  }),
  async (c) => {
    const accessToken = await getAccessTokenFromRequest(c.req.raw);
    if (!accessToken) return c.json({ success: false, error: "Unauthorized" }, 401);

    const { team, owner, repo, number } = c.req.valid("query");
    const { method, commit_title, commit_message } = c.req.valid("json");

    const convex = getConvex({ accessToken });
    const connections = await convex.query(api.github.listProviderConnections, {
      teamSlugOrId: team,
    });

    type Conn = {
      installationId: number;
      accountLogin?: string | null;
      isActive?: boolean | null;
    };

    const target = (connections as Conn[]).find(
      (co) => (co.isActive ?? true) && (co.accountLogin ?? "").toLowerCase() === owner.toLowerCase()
    );
    if (!target) return c.json({ success: false, error: "Installation not found for owner" }, 404);

    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: env.CMUX_GITHUB_APP_ID,
        privateKey: githubPrivateKey,
        installationId: target.installationId,
      },
    });

    try {
      const { data } = await octokit.rest.pulls.merge({
        owner,
        repo,
        pull_number: number,
        merge_method: method,
        commit_title,
        commit_message,
      });
      return c.json({
        success: true,
        merged: !!data.merged,
        sha: data.sha,
        url: `https://github.com/${owner}/${repo}/pull/${number}`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return c.json({ success: false, error: msg }, 200);
    }
  }
);
