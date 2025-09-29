import { getAccessTokenFromRequest } from "@/lib/utils/auth";
import { env } from "@/lib/utils/www-env";
import { api } from "@cmux/convex/api";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";
import { getConvex } from "../utils/get-convex";
import { githubPrivateKey } from "../utils/githubPrivateKey";

export const githubPrsMergeRouter = new OpenAPIHono();

const MergeBody = z
  .object({
    team: z
      .string()
      .min(1)
      .openapi({ description: "Team slug or UUID" }),
    owner: z
      .string()
      .min(1)
      .openapi({ description: "GitHub owner or organization" }),
    repo: z
      .string()
      .min(1)
      .openapi({ description: "GitHub repository name" }),
    number: z
      .coerce
      .number()
      .int()
      .min(1)
      .openapi({ description: "Pull request number" }),
    method: z
      .enum(["squash", "rebase", "merge"])
      .openapi({ description: "GitHub merge method" }),
  })
  .openapi("GithubPrsMergeBody");

const MergeResponse = z
  .object({
    merged: z.boolean(),
    sha: z.string().optional(),
    message: z.string().optional(),
  })
  .openapi("GithubPrsMergeResponse");

type PullRequestDetail = {
  id: number;
  number: number;
  title: string;
  state: string;
  merged?: boolean | null;
  draft?: boolean | null;
  merge_commit_sha?: string | null;
  html_url?: string | null;
  node_id?: string | null;
  user?: { login?: string | null; id?: number | null } | null;
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

type MergeResult = {
  merged: boolean;
  sha?: string;
  message?: string;
};

type ProviderConnection = {
  installationId: number;
  accountLogin?: string | null;
  isActive?: boolean | null;
};

const mutationMarkReady = `
  mutation($pullRequestId: ID!) {
    markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
      pullRequest {
        id
        isDraft
      }
    }
  }
`;

const parseTimestamp = (value?: string | null) => {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toRecord = (pr: PullRequestDetail) => {
  const state: "open" | "closed" = pr.state === "closed" ? "closed" : "open";
  return {
    providerPrId: pr.id,
    repositoryId: pr.base?.repo?.id ?? undefined,
    title: pr.title,
    state,
    merged: Boolean(pr.merged ?? pr.merged_at),
    draft: Boolean(pr.draft),
    authorLogin: pr.user?.login ?? undefined,
    authorId: pr.user?.id ?? undefined,
    htmlUrl: pr.html_url ?? undefined,
    baseRef: pr.base?.ref ?? undefined,
    headRef: pr.head?.ref ?? undefined,
    baseSha: pr.base?.sha ?? undefined,
    headSha: pr.head?.sha ?? undefined,
    mergeCommitSha: pr.merge_commit_sha ?? undefined,
    createdAt: parseTimestamp(pr.created_at),
    updatedAt: parseTimestamp(pr.updated_at),
    closedAt: parseTimestamp(pr.closed_at),
    mergedAt: parseTimestamp(pr.merged_at),
    commentsCount: pr.comments ?? undefined,
    reviewCommentsCount: pr.review_comments ?? undefined,
    commitsCount: pr.commits ?? undefined,
    additions: pr.additions ?? undefined,
    deletions: pr.deletions ?? undefined,
    changedFiles: pr.changed_files ?? undefined,
  };
};

githubPrsMergeRouter.openapi(
  createRoute({
    method: "post" as const,
    path: "/integrations/github/prs/merge",
    tags: ["Integrations"],
    summary: "Merge a GitHub pull request",
    request: {
      body: {
        content: {
          "application/json": {
            schema: MergeBody,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Merge completed",
        content: {
          "application/json": {
            schema: MergeResponse,
          },
        },
      },
      400: { description: "Invalid request" },
      401: { description: "Unauthorized" },
      404: { description: "Not found" },
      500: { description: "Server error" },
    },
  }),
  async (c) => {
    const accessToken = await getAccessTokenFromRequest(c.req.raw);
    if (!accessToken) {
      return c.text("Unauthorized", 401);
    }

    const { team, owner, repo, number, method } = c.req.valid("json");

    const convex = getConvex({ accessToken });
    const connections = await convex.query(api.github.listProviderConnections, {
      teamSlugOrId: team,
    });

    const target = (connections as ProviderConnection[]).find((connection) => {
      if (connection.isActive === false) return false;
      const login = connection.accountLogin ?? "";
      return login.toLowerCase() === owner.toLowerCase();
    });

    if (!target) {
      return c.text("Installation not found for owner", 404);
    }

    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: env.CMUX_GITHUB_APP_ID,
        privateKey: githubPrivateKey,
        installationId: target.installationId,
      },
    });

    const fetchDetail = async (): Promise<PullRequestDetail> => {
      const prRes = await octokit.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}",
        {
          owner,
          repo,
          pull_number: number,
        },
      );
      return prRes.data as unknown as PullRequestDetail;
    };

    try {
      let detail = await fetchDetail();

      if (detail.draft) {
        if (!detail.node_id) {
          throw new Error("Draft pull request is missing node id");
        }
        await octokit.graphql(mutationMarkReady, {
          pullRequestId: detail.node_id,
        });
        detail = await fetchDetail();
      }

      if (detail.state === "closed" && !detail.merged) {
        await octokit.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
          owner,
          repo,
          pull_number: number,
          state: "open",
        });
        detail = await fetchDetail();
      }

      const mergeRes = await octokit.request(
        "PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge",
        {
          owner,
          repo,
          pull_number: number,
          merge_method: method,
        },
      );

      const mergeData = mergeRes.data as unknown as MergeResult & {
        merged?: boolean;
        sha?: string;
        message?: string;
      };

      if (!mergeData.merged) {
        const message = mergeData.message ?? "Merge was not completed";
        return c.json({
          merged: false,
          message,
        }, 400);
      }

      const mergedDetail = await fetchDetail();

      const record = toRecord(mergedDetail);
      if (!record.mergeCommitSha && mergeData.sha) {
        record.mergeCommitSha = mergeData.sha;
      }

      await convex.mutation(api.github_prs.upsertFromServer, {
        teamSlugOrId: team,
        installationId: target.installationId,
        repoFullName: `${owner}/${repo}`,
        number,
        record,
      });

      return c.json({
        merged: true,
        sha: mergeData.sha,
        message: mergeData.message,
      });
    } catch (error) {
      const status = (() => {
        if (error && typeof error === "object" && "status" in error) {
          const maybeStatus = (error as { status?: number | null }).status;
          if (typeof maybeStatus === "number" && maybeStatus >= 100) {
            return maybeStatus;
          }
        }
        return 500;
      })();
      const message =
        error instanceof Error ? error.message : "Failed to merge pull request";
      const normalizedStatus: 400 | 401 | 404 | 500 =
        status === 400 || status === 401 || status === 404 ? status : 500;
      return c.json({ merged: false, message }, normalizedStatus);
    }
  },
);

export default githubPrsMergeRouter;
