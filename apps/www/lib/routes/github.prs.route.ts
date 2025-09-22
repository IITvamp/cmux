import { getAccessTokenFromRequest } from "@/lib/utils/auth";
import { env } from "@/lib/utils/www-env";
import { api } from "@cmux/convex/api";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createAppAuth } from "@octokit/auth-app";
import { RequestError } from "@octokit/request-error";
import { Octokit } from "octokit";
import { getConvex } from "../utils/get-convex";
import { githubPrivateKey } from "../utils/githubPrivateKey";

type GithubProviderConnection = {
  installationId: number;
  accountLogin?: string | null;
  accountType?: "Organization" | "User" | null;
  isActive?: boolean | null;
};

type GithubPullRequest = {
  id?: number | null;
  number: number;
  title: string;
  state: string;
  merged?: boolean | null;
  draft?: boolean | null;
  user?: { login?: string | null; id?: number | null } | null;
  html_url?: string | null;
  base?: {
    ref?: string | null;
    sha?: string | null;
    repo?: { id?: number | null } | null;
  } | null;
  head?: { ref?: string | null; sha?: string | null } | null;
  created_at?: string | null;
  updated_at?: string | null;
  closed_at?: string | null;
  merged_at?: string | null;
  comments?: number | null;
  review_comments?: number | null;
  commits?: number | null;
  additions?: number | null;
  deletions?: number | null;
  changed_files?: number | null;
};

const toNumberOrUndefined = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const toStringOrUndefined = (value: string | null | undefined) =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const toTimestampOrUndefined = (value: string | null | undefined) => {
  if (typeof value !== "string") return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
};

const mapPullRequestForConvex = (pr: GithubPullRequest) => {
  const normalizedState: "open" | "closed" =
    toStringOrUndefined(pr.state)?.toLowerCase() === "closed"
      ? "closed"
      : "open";

  return {
    providerPrId: toNumberOrUndefined(pr.id ?? undefined),
    repositoryId: toNumberOrUndefined(pr.base?.repo?.id ?? undefined),
    title: toStringOrUndefined(pr.title) ?? "",
    state: normalizedState,
    merged: typeof pr.merged === "boolean" ? pr.merged : undefined,
    draft: typeof pr.draft === "boolean" ? pr.draft : undefined,
    authorLogin: toStringOrUndefined(pr.user?.login ?? undefined),
    authorId: toNumberOrUndefined(pr.user?.id ?? undefined),
    htmlUrl: toStringOrUndefined(pr.html_url ?? undefined),
    baseRef: toStringOrUndefined(pr.base?.ref ?? undefined),
    headRef: toStringOrUndefined(pr.head?.ref ?? undefined),
    baseSha: toStringOrUndefined(pr.base?.sha ?? undefined),
    headSha: toStringOrUndefined(pr.head?.sha ?? undefined),
    createdAt: toTimestampOrUndefined(pr.created_at ?? undefined),
    updatedAt: toTimestampOrUndefined(pr.updated_at ?? undefined),
    closedAt: toTimestampOrUndefined(pr.closed_at ?? undefined),
    mergedAt: toTimestampOrUndefined(pr.merged_at ?? undefined),
    commentsCount: toNumberOrUndefined(pr.comments ?? undefined),
    reviewCommentsCount: toNumberOrUndefined(pr.review_comments ?? undefined),
    commitsCount: toNumberOrUndefined(pr.commits ?? undefined),
    additions: toNumberOrUndefined(pr.additions ?? undefined),
    deletions: toNumberOrUndefined(pr.deletions ?? undefined),
    changedFiles: toNumberOrUndefined(pr.changed_files ?? undefined),
  };
};

const buildCloseResponse = (owner: string, repo: string, pr: GithubPullRequest) => ({
  ok: true as const,
  pullRequest: {
    repoFullName: `${owner}/${repo}`,
    number: pr.number,
    state: "closed" as const,
    merged: typeof pr.merged === "boolean" ? pr.merged : undefined,
    draft: typeof pr.draft === "boolean" ? pr.draft : undefined,
    title: toStringOrUndefined(pr.title) ?? "",
    updatedAt: toStringOrUndefined(pr.updated_at ?? undefined),
    closedAt: toStringOrUndefined(pr.closed_at ?? undefined),
    htmlUrl: toStringOrUndefined(pr.html_url ?? undefined),
    authorLogin: toStringOrUndefined(pr.user?.login ?? undefined),
  },
});

export const githubPrsRouter = new OpenAPIHono();

const Query = z
  .object({
    team: z.string().min(1).openapi({ description: "Team slug or UUID" }),
    installationId: z.coerce
      .number()
      .optional()
      .openapi({ description: "GitHub App installation ID to query" }),
    q: z
      .string()
      .trim()
      .min(1)
      .optional()
      .openapi({ description: "Optional search term to filter by title or author" }),
    state: z
      .enum(["open", "closed", "all"])
      .optional()
      .default("open")
      .openapi({ description: "Filter PRs by state (default open)" }),
    page: z.coerce
      .number()
      .min(1)
      .default(1)
      .optional()
      .openapi({ description: "1-based page index (default 1)" }),
    per_page: z.coerce
      .number()
      .min(1)
      .max(100)
      .default(20)
      .optional()
      .openapi({ description: "Results per page (default 20, max 100)" }),
  })
  .openapi("GithubPrsQuery");

const PullRequestItem = z
  .object({
    id: z.number(),
    number: z.number(),
    title: z.string(),
    state: z.enum(["open", "closed"]),
    user: z
      .object({
        login: z.string(),
        id: z.number(),
        avatar_url: z.string().url().optional(),
      })
      .optional(),
    repository_full_name: z.string(),
    html_url: z.string().url(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    comments: z.number().optional(),
  })
  .openapi("GithubPullRequestItem");

const PullRequestsResponse = z
  .object({
    total_count: z.number(),
    pullRequests: z.array(PullRequestItem),
  })
  .openapi("GithubPullRequestsResponse");

const CloseBody = z
  .object({
    team: z.string().min(1).openapi({ description: "Team slug or UUID" }),
    owner: z.string().min(1).openapi({ description: "GitHub repository owner" }),
    repo: z.string().min(1).openapi({ description: "GitHub repository name" }),
    number: z.coerce
      .number()
      .min(1)
      .openapi({ description: "Pull request number" }),
  })
  .openapi("GithubPrCloseBody");

const CloseResponse = z
  .object({
    ok: z.literal(true),
    pullRequest: z.object({
      repoFullName: z.string(),
      number: z.number(),
      state: z.literal("closed"),
      merged: z.boolean().optional(),
      draft: z.boolean().optional(),
      title: z.string(),
      updatedAt: z.string().optional(),
      closedAt: z.string().optional(),
      htmlUrl: z.string().url().optional(),
      authorLogin: z.string().optional(),
    }),
  })
  .openapi("GithubPrCloseResponse");

githubPrsRouter.openapi(
  createRoute({
    method: "get" as const,
    path: "/integrations/github/prs",
    tags: ["Integrations"],
    summary: "List pull requests across a GitHub App installation for a team",
    request: { query: Query },
    responses: {
      200: {
        description: "OK",
        content: {
          "application/json": {
            schema: PullRequestsResponse,
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

    const { team, installationId, q, state = "open", page = 1, per_page = 20 } =
      c.req.valid("query");

    // Fetch provider connections for this team using Convex (enforces membership)
    const convex = getConvex({ accessToken });
    const connections = await convex.query(api.github.listProviderConnections, {
      teamSlugOrId: team,
    });

    // Determine which installation to query
    const target = (connections as GithubProviderConnection[]).find(
      (co: GithubProviderConnection) =>
        co.isActive !== false && (!installationId || co.installationId === installationId)
    );

    if (!target) {
      return c.json({ total_count: 0, pullRequests: [] });
    }

    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: env.CMUX_GITHUB_APP_ID,
        privateKey: githubPrivateKey,
        installationId: target.installationId,
      },
    });

    try {
      if (!target.accountLogin) {
        throw new Error(
          `No account login for installation ${target.installationId}`
        );
      }
      const ownerQualifier =
        target.accountType === "Organization"
          ? `org:${target.accountLogin}`
          : `user:${target.accountLogin}`;

      const qualifiers = ["is:pr", ownerQualifier];
      if (state === "open") qualifiers.push("is:open");
      else if (state === "closed") qualifiers.push("is:closed");

      if (q && q.trim().length > 0) {
        // Let GitHub search handle free text (title/body/author)
        qualifiers.push(q.trim());
      }

      const searchQuery = qualifiers.join(" ");
      const res = await octokit.request("GET /search/issues", {
        q: searchQuery,
        sort: "updated",
        order: "desc",
        per_page,
        page,
      });

      type SearchIssueItem = {
        id: number;
        number: number;
        title: string;
        state: "open" | "closed" | string;
        html_url: string;
        repository_url?: string;
        pull_request?: unknown;
        created_at?: string;
        updated_at?: string;
        comments?: number;
        user?: {
          login: string;
          id: number;
          avatar_url?: string;
        };
      };

      const isSearchIssueItem = (v: unknown): v is SearchIssueItem => {
        if (!v || typeof v !== "object") return false;
        const o = v as Record<string, unknown>;
        return (
          typeof o.id === "number" &&
          typeof o.number === "number" &&
          typeof o.title === "string" &&
          typeof o.state === "string" &&
          typeof o.html_url === "string"
        );
      };

      const rawItems: unknown[] = Array.isArray(res.data.items)
        ? (res.data.items as unknown[])
        : [];
      const items = rawItems
        .filter((it: unknown): it is SearchIssueItem =>
          isSearchIssueItem(it) && !!(it as SearchIssueItem).pull_request
        )
        .map((it) => {
          // repository_url looks like https://api.github.com/repos/{owner}/{repo}
          const repoUrl = it.repository_url || "";
          const parts = repoUrl.split("/");
          const owner = parts[parts.length - 2] || "";
          const repo = parts[parts.length - 1] || "";

          return {
            id: it.id,
            number: it.number,
            title: it.title,
            state: (it.state === "open" || it.state === "closed" ? it.state : "open") as
              | "open"
              | "closed",
            user: it.user
              ? {
                  login: it.user.login,
                  id: it.user.id,
                  avatar_url: it.user.avatar_url,
                }
              : undefined,
            repository_full_name: owner && repo ? `${owner}/${repo}` : "",
            html_url: it.html_url,
            created_at: it.created_at,
            updated_at: it.updated_at,
            comments: typeof it.comments === "number" ? it.comments : undefined,
          };
        });

      return c.json({ total_count: typeof res.data.total_count === "number" ? res.data.total_count : 0, pullRequests: items });
    } catch (err) {
      console.error(
        `GitHub PRs fetch failed for installation ${target.installationId}:`,
        err instanceof Error ? err.message : err
      );
      return c.json({ total_count: 0, pullRequests: [] });
    }
  }
);

githubPrsRouter.openapi(
  createRoute({
    method: "post" as const,
    path: "/integrations/github/prs/close",
    tags: ["Integrations"],
    summary: "Close a GitHub pull request",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CloseBody,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Pull request closed",
        content: {
          "application/json": {
            schema: CloseResponse,
          },
        },
      },
      400: { description: "Bad request" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
      404: { description: "Not found" },
      500: { description: "GitHub API error" },
    },
  }),
  async (c) => {
    const accessToken = await getAccessTokenFromRequest(c.req.raw);
    if (!accessToken) return c.text("Unauthorized", 401);

    const { team, owner, repo, number } = c.req.valid("json");
    const convex = getConvex({ accessToken });
    const connections = await convex.query(api.github.listProviderConnections, {
      teamSlugOrId: team,
    });

    const target = (connections as GithubProviderConnection[]).find(
      (co: GithubProviderConnection) =>
        (co.isActive ?? true) &&
        (co.accountLogin ?? "").toLowerCase() === owner.toLowerCase()
    );
    if (!target) {
      return c.json({ message: "Installation not found for owner" }, 404);
    }

    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: env.CMUX_GITHUB_APP_ID,
        privateKey: githubPrivateKey,
        installationId: target.installationId,
      },
    });

    try {
      const response = await octokit.request(
        "PATCH /repos/{owner}/{repo}/pulls/{pull_number}",
        {
          owner,
          repo,
          pull_number: number,
          state: "closed",
        }
      );

      const pr = response.data as GithubPullRequest;

      await convex.mutation(api.github_prs.upsertFromServer, {
        teamSlugOrId: team,
        installationId: target.installationId,
        repoFullName: `${owner}/${repo}`,
        number,
        record: mapPullRequestForConvex(pr),
      });

      return c.json(buildCloseResponse(owner, repo, pr));
    } catch (error: unknown) {
      if (error instanceof RequestError) {
        if (error.status === 404) {
          return c.json({ message: "Pull request not found" }, 404);
        }
        if (error.status === 403) {
          return c.json({ message: "Forbidden" }, 403);
        }
        return c.json({ message: error.message }, 500);
      }
      console.error("[github.prs.close] Unexpected error", error);
      return c.json({ message: "Failed to close pull request" }, 500);
    }
  }
);
