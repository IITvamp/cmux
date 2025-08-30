import { stackServerApp } from "@/lib/utils/stack";
import { api } from "@cmux/convex/api";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createAppAuth } from "@octokit/auth-app";
import { ConvexHttpClient } from "convex/browser";
import { Octokit } from "octokit";

const CONVEX_URL = process.env.VITE_CONVEX_URL || "http://127.0.0.1:9777";

export const githubReposRouter = new OpenAPIHono();

const Query = z
  .object({
    team: z.string().min(1).openapi({ description: "Team slug or UUID" }),
  })
  .openapi("GithubReposQuery");

const Repo = z
  .object({
    name: z.string(),
    full_name: z.string(),
    private: z.boolean(),
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
    // Require Stack auth
    const user = await stackServerApp.getUser({ tokenStore: c.req.raw });
    if (!user) return c.text("Unauthorized", 401);
    const { accessToken } = await user.getAuthJson();
    if (!accessToken) return c.text("Unauthorized", 401);

    // Validate env for GitHub App
    const appId = process.env.GITHUB_APP_ID;
    const privateKeyRaw = process.env.GITHUB_APP_PRIVATE_KEY;
    if (!appId || !privateKeyRaw) {
      return c.text("GitHub App not configured", 501);
    }
    const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

    const { team } = c.req.valid("query");

    // Fetch provider connections for this team using Convex (enforces membership)
    const convex = new ConvexHttpClient(CONVEX_URL);
    convex.setAuth(accessToken);
    const connections = await convex.query(api.github.listProviderConnections, {
      teamSlugOrId: team,
    });

    // Query repos for each active installation
    const results = await Promise.all(
      connections
        .filter((co) => co.isActive)
        .map(async (co) => {
          const octokit = new Octokit({
            authStrategy: createAppAuth,
            auth: {
              appId,
              privateKey,
              installationId: co.installationId,
            },
          });

          try {
            const { data } = await octokit.request(
              "GET /installation/repositories",
              { per_page: 100 }
            );
            const repos = (
              data as unknown as {
                repositories: Array<{
                  name: string;
                  full_name: string;
                  private: boolean;
                }>;
              }
            ).repositories.map((r) => ({
              name: r.name,
              full_name: r.full_name,
              private: !!r.private,
            }));
            return {
              installationId: co.installationId,
              accountLogin: co.accountLogin,
              accountType: co.accountType,
              repos,
            };
          } catch {
            return {
              installationId: co.installationId,
              accountLogin: co.accountLogin,
              accountType: co.accountType,
              repos: [],
            };
          }
        })
    );

    return c.json({ connections: results });
  }
);
