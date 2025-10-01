import { verifyTeamAccess } from "@/lib/utils/team-verification";
import { getConvex } from "@/lib/utils/get-convex";
import { githubPrivateKey } from "@/lib/utils/githubPrivateKey";
import { api } from "@cmux/convex/api";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";
import { getAccessTokenFromRequest } from "../utils/auth";
import { env } from "../utils/www-env";

type GitHubPullRequest = {
  id?: number;
  number?: number;
  title?: string;
  state?: string;
  merged?: boolean;
  draft?: boolean;
  html_url?: string;
  merge_commit_sha?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  closed_at?: string | null;
  merged_at?: string | null;
  comments?: number;
  review_comments?: number;
  commits?: number;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  user?: {
    login?: string;
    id?: number;
  } | null;
  base?: {
    ref?: string;
    sha?: string;
    repo?: {
      id?: number;
    } | null;
  } | null;
  head?: {
    ref?: string;
    sha?: string;
  } | null;
};

type UpsertRecordPayload = {
  providerPrId?: number;
  repositoryId?: number;
  title: string;
  state: "open" | "closed";
  merged?: boolean;
  draft?: boolean;
  authorLogin?: string;
  authorId?: number;
  htmlUrl?: string;
  baseRef?: string;
  headRef?: string;
  baseSha?: string;
  headSha?: string;
  mergeCommitSha?: string;
  createdAt?: number;
  updatedAt?: number;
  closedAt?: number;
  mergedAt?: number;
  commentsCount?: number;
  reviewCommentsCount?: number;
  commitsCount?: number;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
};

const githubPrsManageRouter = new OpenAPIHono();

const ParamsSchema = z
  .object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    number: z.coerce.number().min(1),
  })
  .openapi("GithubPrManageParams");

const QuerySchema = z
  .object({
    team: z.string().min(1).openapi({ description: "Team slug or UUID" }),
  })
  .openapi("GithubPrManageQuery");

const MergeBodySchema = z
  .object({
    method: z.enum(["merge", "squash", "rebase"]).default("merge"),
  })
  .openapi("GithubPrMergeBody");

const CloseBodySchema = z
  .object({
    reason: z.enum(["completed", "not_planned"]).optional(),
  })
  .openapi("GithubPrCloseBody");

const MergeResponseSchema = z
  .object({
    success: z.boolean(),
    merged: z.boolean().optional(),
    commitSha: z.string().optional(),
    message: z.string().optional(),
    error: z.string().optional(),
  })
  .openapi("GithubPrMergeResponse");

const CloseResponseSchema = z
  .object({
    success: z.boolean(),
    state: z.enum(["open", "closed"]).optional(),
    error: z.string().optional(),
  })
  .openapi("GithubPrCloseResponse");

function mapPullRequestToRecord(pr: GitHubPullRequest): UpsertRecordPayload {
  const toStringOrUndefined = (value: unknown): string | undefined =>
    typeof value === "string" && value.length > 0 ? value : undefined;
  const toNumberOrUndefined = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined;
  const toTimestamp = (value: unknown): number | undefined => {
    if (typeof value !== "string") {
      return undefined;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const state = toStringOrUndefined(pr.state) === "closed" ? "closed" : "open";

  return {
    providerPrId: toNumberOrUndefined(pr.id),
    repositoryId: toNumberOrUndefined(pr.base?.repo?.id ?? undefined),
    title: toStringOrUndefined(pr.title) ?? "",
    state,
    merged: pr.merged ?? Boolean(pr.merged_at),
    draft: pr.draft ?? undefined,
    authorLogin: toStringOrUndefined(pr.user?.login ?? undefined),
    authorId: toNumberOrUndefined(pr.user?.id ?? undefined),
    htmlUrl: toStringOrUndefined(pr.html_url),
    baseRef: toStringOrUndefined(pr.base?.ref ?? undefined),
    headRef: toStringOrUndefined(pr.head?.ref ?? undefined),
    baseSha: toStringOrUndefined(pr.base?.sha ?? undefined),
    headSha: toStringOrUndefined(pr.head?.sha ?? undefined),
    mergeCommitSha: toStringOrUndefined(pr.merge_commit_sha ?? undefined),
    createdAt: toTimestamp(pr.created_at ?? undefined),
    updatedAt: toTimestamp(pr.updated_at ?? undefined),
    closedAt: toTimestamp(pr.closed_at ?? undefined),
    mergedAt: toTimestamp(pr.merged_at ?? undefined),
    commentsCount: toNumberOrUndefined(pr.comments),
    reviewCommentsCount: toNumberOrUndefined(pr.review_comments),
    commitsCount: toNumberOrUndefined(pr.commits),
    additions: toNumberOrUndefined(pr.additions),
    deletions: toNumberOrUndefined(pr.deletions),
    changedFiles: toNumberOrUndefined(pr.changed_files),
  };
}

async function getOctokitForInstallation(installationId: number) {
  if (!env.CMUX_GITHUB_APP_ID) {
    throw new Error("CMUX_GITHUB_APP_ID is not configured");
  }
  if (!githubPrivateKey) {
    throw new Error("GitHub private key is not configured");
  }

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: env.CMUX_GITHUB_APP_ID,
      privateKey: githubPrivateKey,
      installationId,
    },
  });
}

async function syncPullRequestState(args: {
  convex: ReturnType<typeof getConvex>;
  teamSlugOrId: string;
  installationId: number;
  repoFullName: string;
  number: number;
  pull: GitHubPullRequest;
}) {
  const { convex, teamSlugOrId, installationId, repoFullName, number, pull } = args;
  const record = mapPullRequestToRecord(pull);
  await convex.mutation(api.github_prs.upsertFromServer, {
    teamSlugOrId,
    installationId,
    repoFullName,
    number,
    record,
  });
}

githubPrsManageRouter.openapi(
  createRoute({
    method: "post" as const,
    path: "/integrations/github/prs/{owner}/{repo}/{number}/merge",
    tags: ["Integrations"],
    summary: "Merge a GitHub pull request via the cmux GitHub App",
    request: {
      params: ParamsSchema,
      query: QuerySchema,
      body: {
        content: {
          "application/json": {
            schema: MergeBodySchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Merge result",
        content: {
          "application/json": {
            schema: MergeResponseSchema,
          },
        },
      },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
      404: { description: "Pull request not found" },
      409: { description: "Pull request could not be merged" },
      500: { description: "Internal error" },
    },
  }),
  async (c) => {
    const accessToken = await getAccessTokenFromRequest(c.req.raw);
    if (!accessToken) {
      return c.text("Unauthorized", 401);
    }

    const params = c.req.valid("param");
    const query = c.req.valid("query");
    const body = c.req.valid("json");

    await verifyTeamAccess({ req: c.req.raw, teamSlugOrId: query.team });

    const convex = getConvex({ accessToken });

    const repoFullName = `${params.owner}/${params.repo}`;
    const pullRequest = await convex.query(api.github_prs.getByRepoAndNumber, {
      teamSlugOrId: query.team,
      repoFullName,
      number: params.number,
    });

    if (!pullRequest) {
      return c.json(
        {
          success: false,
          error: "Pull request not found",
        },
        404,
      );
    }

    const octokit = await getOctokitForInstallation(pullRequest.installationId);

    try {
      const mergeResult = await octokit.request(
        "PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge",
        {
          owner: params.owner,
          repo: params.repo,
          pull_number: params.number,
          merge_method: body.method ?? "merge",
        },
      );

      const detail = await octokit.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}",
        {
          owner: params.owner,
          repo: params.repo,
          pull_number: params.number,
        },
      );

      await syncPullRequestState({
        convex,
        teamSlugOrId: query.team,
        installationId: pullRequest.installationId,
        repoFullName,
        number: params.number,
        pull: detail.data as GitHubPullRequest,
      });

      return c.json({
        success: true,
        merged: Boolean(mergeResult.data.merged),
        commitSha: typeof mergeResult.data.sha === "string" ? mergeResult.data.sha : undefined,
        message:
          typeof mergeResult.data.message === "string"
            ? mergeResult.data.message
            : undefined,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to merge pull request";
      return c.json({ success: false, error: message }, 409);
    }
  },
);

githubPrsManageRouter.openapi(
  createRoute({
    method: "post" as const,
    path: "/integrations/github/prs/{owner}/{repo}/{number}/close",
    tags: ["Integrations"],
    summary: "Close a GitHub pull request via the cmux GitHub App",
    request: {
      params: ParamsSchema,
      query: QuerySchema,
      body: {
        content: {
          "application/json": {
            schema: CloseBodySchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Close result",
        content: {
          "application/json": {
            schema: CloseResponseSchema,
          },
        },
      },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
      404: { description: "Pull request not found" },
      409: { description: "Pull request could not be closed" },
      500: { description: "Internal error" },
    },
  }),
  async (c) => {
    const accessToken = await getAccessTokenFromRequest(c.req.raw);
    if (!accessToken) {
      return c.text("Unauthorized", 401);
    }

    const params = c.req.valid("param");
    const query = c.req.valid("query");
    const body = c.req.valid("json");

    await verifyTeamAccess({ req: c.req.raw, teamSlugOrId: query.team });

    const convex = getConvex({ accessToken });
    const repoFullName = `${params.owner}/${params.repo}`;

    const pullRequest = await convex.query(api.github_prs.getByRepoAndNumber, {
      teamSlugOrId: query.team,
      repoFullName,
      number: params.number,
    });

    if (!pullRequest) {
      return c.json(
        {
          success: false,
          error: "Pull request not found",
        },
        404,
      );
    }

    const octokit = await getOctokitForInstallation(pullRequest.installationId);

    try {
      await octokit.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
        owner: params.owner,
        repo: params.repo,
        pull_number: params.number,
        state: "closed",
        state_reason: body.reason,
      });

      const detail = await octokit.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}",
        {
          owner: params.owner,
          repo: params.repo,
          pull_number: params.number,
        },
      );

      await syncPullRequestState({
        convex,
        teamSlugOrId: query.team,
        installationId: pullRequest.installationId,
        repoFullName,
        number: params.number,
        pull: detail.data as GitHubPullRequest,
      });

      return c.json({
        success: true,
        state: "closed",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to close pull request";
      return c.json({ success: false, error: message }, 409);
    }
  },
);

export { githubPrsManageRouter };
