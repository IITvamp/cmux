import { getAccessTokenFromRequest } from "@/lib/utils/auth";
import { env } from "@/lib/utils/www-env";
import { api } from "@cmux/convex/api";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";
import { getConvex } from "../utils/get-convex";
import { githubPrivateKey } from "../utils/githubPrivateKey";

export const githubCommitsRouter = new OpenAPIHono();

const Params = z
  .object({
    owner: z.string().min(1).openapi({ description: "Repository owner" }),
    repo: z.string().min(1).openapi({ description: "Repository name" }),
    ref: z.string().min(1).openapi({ description: "Commit-ish (branch, tag, or SHA)" }),
  })
  .openapi("GithubCommitsParams");

const Query = z
  .object({
    team: z.string().min(1).openapi({ description: "Team slug or UUID" }),
  })
  .openapi("GithubCommitsQuery");

const CommitResponse = z
  .object({
    sha: z.string(),
    commit: z
      .object({
        author: z.object({ date: z.string().optional() }).optional(),
        committer: z.object({ date: z.string().optional() }).optional(),
      })
      .optional(),
    html_url: z.string().optional(),
  })
  .openapi("GithubCommitResponse");

githubCommitsRouter.openapi(
  createRoute({
    method: "get" as const,
    path: "/integrations/github/commits/{owner}/{repo}/{ref}",
    tags: ["Integrations"],
    summary: "Resolve a commit-ish to a SHA for a repository",
    request: { params: Params, query: Query },
    responses: {
      200: { description: "OK", content: { "application/json": { schema: CommitResponse } } },
      400: { description: "Bad request" },
      401: { description: "Unauthorized" },
      404: { description: "Not found" },
      501: { description: "Not configured" },
    },
  }),
  async (c) => {
    const accessToken = await getAccessTokenFromRequest(c.req.raw);
    if (!accessToken) return c.text("Unauthorized", 401);

    const { owner, repo, ref } = c.req.valid("param");
    const { team } = c.req.valid("query");

    const convex = getConvex({ accessToken });
    const connections = await convex.query(api.github.listProviderConnections, {
      teamSlugOrId: team,
    });

    type Conn = {
      installationId: number;
      isActive?: boolean | null;
      accountLogin?: string | null;
    };
    const target = (connections as Conn[]).find(
      (co) => co.isActive !== false && (co.accountLogin || "").toLowerCase() === owner.toLowerCase()
    );
    if (!target) return c.text("Not found", 404);

    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: env.CMUX_GITHUB_APP_ID,
        privateKey: githubPrivateKey,
        installationId: target.installationId,
      },
    });

    try {
      const res = await octokit.request("GET /repos/{owner}/{repo}/commits/{ref}", {
        owner,
        repo,
        ref,
      });
      const data = res.data as any;
      return c.json({ sha: String(data?.sha ?? ""), commit: data?.commit, html_url: data?.html_url });
    } catch (err) {
      return c.text("Not found", 404);
    }
  }
);

