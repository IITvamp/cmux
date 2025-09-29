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
    team: z.string().min(1),
    owner: z.string().min(1),
    repo: z.string().min(1),
    number: z.coerce.number().min(1),
    method: z.enum(["squash", "rebase", "merge"]).default("squash"),
  })
  .openapi("GithubPrsMergeBody");

const MergeResponse = z
  .object({
    merged: z.boolean(),
    commitSha: z.string().optional(),
    htmlUrl: z.string().url().optional(),
    message: z.string().optional(),
  })
  .openapi("GithubPrsMergeResponse");

const ErrorResponse = z
  .object({
    error: z.string(),
  })
  .openapi("GithubPrsMergeError");

function toUpsertRecord(pr: {
  id?: number;
  number: number;
  title: string;
  state?: string;
  merged?: boolean;
  draft?: boolean;
  user?: { login?: string | null; id?: number | null } | null;
  html_url?: string | null;
  base?: {
    ref?: string | null;
    sha?: string | null;
    repo?: { id?: number | null } | null;
  } | null;
  head?: { ref?: string | null; sha?: string | null } | null;
  merge_commit_sha?: string | null;
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
}) {
  const ts = (value?: string | null) => {
    if (!value) {
      return undefined;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  return {
    providerPrId: typeof pr.id === "number" ? pr.id : undefined,
    repositoryId:
      typeof pr.base?.repo?.id === "number" ? pr.base.repo.id : undefined,
    title: pr.title,
    state: pr.state === "closed" ? "closed" : "open",
    merged: pr.merged ?? undefined,
    draft: pr.draft ?? undefined,
    authorLogin: pr.user?.login ?? undefined,
    authorId: typeof pr.user?.id === "number" ? pr.user.id : undefined,
    htmlUrl: pr.html_url ?? undefined,
    baseRef: pr.base?.ref ?? undefined,
    headRef: pr.head?.ref ?? undefined,
    baseSha: pr.base?.sha ?? undefined,
    headSha: pr.head?.sha ?? undefined,
    mergeCommitSha: pr.merge_commit_sha ?? undefined,
    createdAt: ts(pr.created_at),
    updatedAt: ts(pr.updated_at),
    closedAt: ts(pr.closed_at),
    mergedAt: ts(pr.merged_at),
    commentsCount: pr.comments ?? undefined,
    reviewCommentsCount: pr.review_comments ?? undefined,
    commitsCount: pr.commits ?? undefined,
    additions: pr.additions ?? undefined,
    deletions: pr.deletions ?? undefined,
    changedFiles: pr.changed_files ?? undefined,
  } as const;
}

async function markReadyIfDraft(octokit: Octokit, pr: { draft?: boolean; node_id?: string }) {
  if (!pr.draft) {
    return;
  }
  if (typeof pr.node_id !== "string" || pr.node_id.length === 0) {
    throw new Error("Missing pull request node identifier");
  }

  const mutation = `
    mutation($pullRequestId: ID!) {
      markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
        pullRequest { id isDraft }
      }
    }
  `;

  await octokit.graphql(mutation, { pullRequestId: pr.node_id });
}

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
        description: "Merge result",
        content: {
          "application/json": {
            schema: MergeResponse,
          },
        },
      },
      400: {
        description: "Invalid request",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      401: { description: "Unauthorized" },
      404: {
        description: "Installation or pull request not found",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      409: {
        description: "Merge conflict or already merged",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
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

    type Connection = {
      installationId: number;
      accountLogin?: string | null;
      accountType?: "Organization" | "User" | null;
      isActive?: boolean | null;
    };

    const target = (connections as Connection[]).find(
      (connection) =>
        (connection.isActive ?? true) &&
        (connection.accountLogin ?? "").toLowerCase() === owner.toLowerCase()
    );

    if (!target) {
      return c.json({ error: "Installation not found for owner" }, 404);
    }

    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: env.CMUX_GITHUB_APP_ID,
        privateKey: githubPrivateKey,
        installationId: target.installationId,
      },
    });

    const repoFullName = `${owner}/${repo}`;

    let pr;
    try {
      const prRes = await octokit.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}",
        { owner, repo, pull_number: number }
      );
      pr = prRes.data as typeof prRes.data & { node_id?: string };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load pull request";
      return c.json({ error: message }, 404);
    }

    if (pr.merged) {
      return c.json(
        {
          merged: true,
          commitSha: pr.merge_commit_sha ?? undefined,
          htmlUrl: pr.html_url ?? undefined,
          message: "Pull request is already merged",
        },
        200
      );
    }

    try {
      await markReadyIfDraft(octokit, pr);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to mark PR ready";
      return c.json({ error: message }, 400);
    }

    if ((pr.state ?? "open").toLowerCase() === "closed") {
      try {
        await octokit.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
          owner,
          repo,
          pull_number: number,
          state: "open",
        });
        const reopened = await octokit.request(
          "GET /repos/{owner}/{repo}/pulls/{pull_number}",
          { owner, repo, pull_number: number }
        );
        pr = reopened.data as typeof reopened.data & { node_id?: string };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to reopen PR";
        return c.json({ error: message }, 400);
      }
    }

    const truncatedTitle = pr.title.length > 72 ? `${pr.title.slice(0, 69)}...` : pr.title;

    let mergeData: { sha?: string; message?: string } | null = null;
    try {
      const mergeResult = await octokit.request(
        "PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge",
        {
          owner,
          repo,
          pull_number: number,
          merge_method: method,
          commit_title: truncatedTitle,
          commit_message: `Merged via cmux for ${repoFullName}#${number}`,
        }
      );
      mergeData = (mergeResult.data as unknown as { sha?: string; message?: string }) ?? null;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to merge PR";
      const maybeStatus =
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        typeof (error as { status?: unknown }).status === "number"
          ? (error as { status: number }).status
          : undefined;
      const statusCode = maybeStatus === 409 ? 409 : 400;
      return c.json({ error: message }, statusCode);
    }

    const mergedDetailRes = await octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      { owner, repo, pull_number: number }
    );
    const mergedPr = mergedDetailRes.data as typeof mergedDetailRes.data;

    await convex.mutation(api.github_prs.upsertFromServer, {
      teamSlugOrId: team,
      installationId: target.installationId,
      repoFullName,
      number,
      record: toUpsertRecord(mergedPr),
    });

    return c.json({
      merged: Boolean(mergedPr.merged_at) || Boolean(mergedPr.merged),
      commitSha: mergeData?.sha,
      htmlUrl: mergedPr.html_url ?? undefined,
      message: mergeData?.message,
    });
  }
);
