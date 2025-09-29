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
    owner: z.string().min(1).openapi({ description: "GitHub owner/org" }),
    repo: z.string().min(1).openapi({ description: "GitHub repo name" }),
    number: z.coerce.number().min(1).openapi({ description: "PR number" }),
    method: z
      .enum(["squash", "rebase", "merge"]) // match client MergeMethod
      .openapi({ description: "Merge strategy" }),
    commitTitle: z
      .string()
      .optional()
      .openapi({ description: "Optional commit title for squash/merge" }),
    commitMessage: z
      .string()
      .optional()
      .openapi({ description: "Optional commit message for squash/merge" }),
  })
  .openapi("GithubPrsMergeBody");

const MergeResponse = z
  .object({
    merged: z.boolean(),
    sha: z.string().optional(),
    message: z.string().optional(),
    html_url: z.string().optional(),
  })
  .openapi("GithubPrsMergeResponse");

githubPrsMergeRouter.openapi(
  createRoute({
    method: "post" as const,
    path: "/integrations/github/prs/merge",
    tags: ["Integrations"],
    summary: "Merge a GitHub PR by owner/repo/number for a team installation",
    request: {
      body: {
        content: {
          "application/json": { schema: Body },
        },
        required: true,
      },
    },
    responses: {
      200: { description: "OK", content: { "application/json": { schema: MergeResponse } } },
      400: { description: "Bad request" },
      401: { description: "Unauthorized" },
      404: { description: "Installation not found for owner" },
      409: { description: "Merge conflict or not mergeable" },
    },
  }),
  async (c) => {
    const accessToken = await getAccessTokenFromRequest(c.req.raw);
    if (!accessToken) return c.text("Unauthorized", 401);

    const { team, owner, repo, number, method, commitTitle, commitMessage } =
      c.req.valid("json");

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
      (co) => (co.isActive ?? true) && (co.accountLogin ?? "").toLowerCase() === owner.toLowerCase(),
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
      const { data } = await octokit.rest.pulls.merge({
        owner,
        repo,
        pull_number: number,
        merge_method: method,
        commit_title: commitTitle,
        commit_message: commitMessage,
      });

      return c.json({
        merged: Boolean(data.merged),
        sha: (data as unknown as { sha?: string }).sha,
        message: (data as unknown as { message?: string }).message,
        html_url: (data as unknown as { html_url?: string }).html_url,
      });
    } catch (err) {
      // Common failure reasons: not mergeable, conflict, or permissions
      const message = err instanceof Error ? err.message : String(err);
      const status = /merge|conflict|not mergeable|405|409/i.test(message) ? 409 : 400;
      return c.json({ merged: false, message }, status);
    }
  },
);

