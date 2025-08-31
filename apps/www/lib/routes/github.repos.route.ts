import { getAccessTokenFromRequest } from "@/lib/utils/auth";
import { env } from "@/lib/utils/www-env";
import { api } from "@cmux/convex/api";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";
import { getConvex } from "../utils/get-convex";

export const githubReposRouter = new OpenAPIHono();

const Query = z
  .object({
    team: z.string().min(1).openapi({ description: "Team slug or UUID" }),
    installationId: z.coerce
      .number()
      .optional()
      .openapi({ description: "GitHub App installation ID to query" }),
  })
  .openapi("GithubReposQuery");

const Repo = z
  .object({
    name: z.string(),
    full_name: z.string(),
    private: z.boolean(),
    // ISO timestamp strings from GitHub API
    updated_at: z.string().optional(),
    pushed_at: z.string().optional(),
  })
  .openapi("GithubRepo");

const Connection = z
  .object({
    installationId: z.number(),
    accountLogin: z.string().optional(),
    accountType: z.enum(["User", "Organization"]).optional(),
    repos: z.array(Repo),
  })
  .openapi("GithubConnectionRepos");

githubReposRouter.openapi(
  createRoute({
    method: "get" as const,
    path: "/integrations/github/repos",
    tags: ["Integrations"],
    summary: "List repos per GitHub App installation for a team",
    request: { query: Query },
    responses: {
      200: {
        description: "OK",
        content: {
          "application/json": {
            schema: z.object({ connections: z.array(Connection) }),
          },
        },
      },
      401: { description: "Unauthorized" },
      400: { description: "Bad request" },
      501: { description: "Not configured" },
    },
  }),
  async (c) => {
    const accessToken = await getAccessTokenFromRequest(c.req.raw);
    if (!accessToken) return c.text("Unauthorized", 401);
    const privateKey = env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n");

    const { team, installationId } = c.req.valid("query");

    // Fetch provider connections for this team using Convex (enforces membership)
    const convex = getConvex({ accessToken });
    const connections = await convex.query(api.github.listProviderConnections, {
      teamSlugOrId: team,
    });

    // Narrow to a single active connection
    const active = connections.filter((co) => co.isActive);
    const target = installationId
      ? active.find((c0) => c0.installationId === installationId)
      : active[0];

    if (!target) {
      return c.json({ connections: [] });
    }

    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: env.GITHUB_APP_ID,
        privateKey,
        installationId: target.installationId,
      },
    });

    try {
      const { data } = await octokit.request("GET /installation/repositories", {
        per_page: 100,
      });
      const repos = data.repositories.map((r) => ({
        name: r.name,
        full_name: r.full_name,
        private: !!r.private,
        updated_at: r.updated_at,
        pushed_at: r.pushed_at,
      }));
      return c.json({
        connections: [
          {
            installationId: target.installationId,
            accountLogin: target.accountLogin,
            accountType: target.accountType,
            repos,
          },
        ],
      });
    } catch {
      return c.json({
        connections: [
          {
            installationId: target.installationId,
            accountLogin: target.accountLogin,
            accountType: target.accountType,
            repos: [],
          },
        ],
      });
    }
  }
);
