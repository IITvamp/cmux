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
    number: z.coerce
      .number()
      .min(1)
      .openapi({ description: "PR number" }),
    method: z
      .enum(["squash", "rebase", "merge"]) // Align with client MergeMethod
      .openapi({ description: "Merge method" }),
  })
  .openapi("GithubPrsMergeBody");

const MergeResponse = z
  .object({
    merged: z.boolean(),
    message: z.string().optional(),
    sha: z.string().optional(),
    html_url: z.string().url().optional(),
  })
  .openapi("GithubPrsMergeResponse");

githubPrsMergeRouter.openapi(
  createRoute({
    method: "post" as const,
    path: "/integrations/github/prs/merge",
    tags: ["Integrations"],
    summary: "Merge a GitHub pull request (private repos supported)",
    request: {
      body: {
        content: {
          "application/json": { schema: Body },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Merged",
        content: { "application/json": { schema: MergeResponse } },
      },
      400: { description: "Bad request" },
      401: { description: "Unauthorized" },
      404: { description: "Not found" },
      500: { description: "Merge failed" },
    },
  }),
  async (c) => {
    const accessToken = await getAccessTokenFromRequest(c.req.raw);
    if (!accessToken) return c.text("Unauthorized", 401);

    const { team, owner, repo, number, method } = c.req.valid("json");
    const convex = getConvex({ accessToken });

    // Find installation for the owner
    const connections = await convex.query(api.github.listProviderConnections, {
      teamSlugOrId: team,
    });
    type Conn = {
      installationId: number;
      accountLogin?: string | null;
      isActive?: boolean | null;
    };
    const target = (connections as Conn[]).find(
      (co: Conn) => co.isActive !== false && (co.accountLogin ?? "").toLowerCase() === owner.toLowerCase()
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
      // Attempt merge
      const mergeRes = await octokit.rest.pulls.merge({
        owner,
        repo,
        pull_number: number,
        merge_method: method,
      });

      // Fetch detail to upsert into Convex
      const prRes = await octokit.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}",
        { owner, repo, pull_number: number }
      );
      const pr = prRes.data as unknown as {
        id: number;
        number: number;
        title: string;
        state: "open" | "closed" | string;
        merged?: boolean;
        draft?: boolean;
        user?: { login?: string; id?: number } | null;
        html_url?: string;
        base?: { ref?: string; sha?: string; repo?: { id?: number } };
        head?: { ref?: string; sha?: string };
        created_at?: string;
        updated_at?: string;
        closed_at?: string | null;
        merged_at?: string | null;
        comments?: number;
        review_comments?: number;
        commits?: number;
        additions?: number;
        deletions?: number;
        changed_files?: number;
      };

      const ts = (s?: string | null) => (s ? Date.parse(s) : undefined);
      await convex.mutation(api.github_prs.upsertFromServer, {
        teamSlugOrId: team,
        installationId: target.installationId,
        repoFullName: `${owner}/${repo}`,
        number,
        record: {
          providerPrId: pr.id,
          repositoryId: pr.base?.repo?.id,
          title: pr.title,
          state: pr.state === "closed" ? "closed" : "open",
          merged: !!pr.merged,
          draft: !!pr.draft,
          authorLogin: pr.user?.login ?? undefined,
          authorId: pr.user?.id ?? undefined,
          htmlUrl: pr.html_url ?? undefined,
          baseRef: pr.base?.ref ?? undefined,
          headRef: pr.head?.ref ?? undefined,
          baseSha: pr.base?.sha ?? undefined,
          headSha: pr.head?.sha ?? undefined,
          createdAt: ts(pr.created_at),
          updatedAt: ts(pr.updated_at),
          closedAt: ts(pr.closed_at ?? undefined),
          mergedAt: ts(pr.merged_at ?? undefined),
          commentsCount: pr.comments,
          reviewCommentsCount: pr.review_comments,
          commitsCount: pr.commits,
          additions: pr.additions,
          deletions: pr.deletions,
          changedFiles: pr.changed_files,
        },
      });

      return c.json({
        merged: !!mergeRes.data.merged,
        message: mergeRes.data.message,
        sha: mergeRes.data.sha,
        html_url: (mergeRes.data as unknown as { html_url?: string }).html_url,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[Merge PR] Failed:", message);
      return c.json({ merged: false, message }, 500);
    }
  }
);

