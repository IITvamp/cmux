import { getAccessTokenFromRequest } from "@/lib/utils/auth";
import { env } from "@/lib/utils/www-env";
import { api } from "@cmux/convex/api";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";
import { getConvex } from "../utils/get-convex";
import { githubPrivateKey } from "../utils/githubPrivateKey";

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
    updated_at: z.string().nullable().optional(),
    pushed_at: z.string().nullable().optional(),
  })
  .openapi("GithubRepo");

const ReposResponse = z
  .object({
    repos: z.array(Repo),
  })
  .openapi("GithubReposResponse");

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
            schema: ReposResponse,
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

    const { team, installationId } = c.req.valid("query");

    // Fetch provider connections for this team using Convex (enforces membership)
    const convex = getConvex({ accessToken });
    const connections = await convex.query(api.github.listProviderConnections, {
      teamSlugOrId: team,
    });

    // Determine which installations to query
    const target = connections.find(
      (co) => co.isActive && co.installationId === installationId
    );

    if (!target) {
      return c.json({ repos: [] });
    }

    const allRepos: Array<z.infer<typeof Repo>> = [];
    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: env.GITHUB_APP_ID,
        privateKey: githubPrivateKey,
        installationId: target.installationId,
      },
    });
    try {
      const { data } = await octokit.request("GET /installation/repositories", {
        per_page: 100,
      });

      allRepos.push(
        ...data.repositories.map((r) => ({
          name: r.name,
          full_name: r.full_name,
          private: !!r.private,
          updated_at: r.updated_at,
          pushed_at: r.pushed_at,
        }))
      );
    } catch (err) {
      console.error(
        `GitHub repositories fetch failed for installation ${target.installationId}:`,
        err instanceof Error ? err.message : err
      );
    }

    // Dedupe by full_name
    const seen = new Set<string>();
    const deduped = allRepos.filter((r) => {
      if (seen.has(r.full_name)) return false;
      seen.add(r.full_name);
      return true;
    });
    return c.json({ repos: deduped });
  }
);
