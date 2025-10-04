import { verifyTeamAccess } from "@/lib/utils/team-verification";
import { stackServerAppJs } from "@/lib/utils/stack";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { Octokit } from "octokit";

type GitHubPrDetail = {
  number: number;
  html_url: string;
  state: string;
  draft?: boolean;
  merged_at: string | null;
  node_id: string;
};

type OctokitThrottleOptions = {
  method?: string;
  url?: string;
};

const MergePullRequestDirectBody = z
  .object({
    teamSlugOrId: z.string(),
    owner: z.string(),
    repo: z.string(),
    number: z.number(),
    method: z.enum(["squash", "rebase", "merge"]),
  })
  .openapi("GithubMergePrDirectRequest");

const ClosePullRequestDirectBody = z
  .object({
    teamSlugOrId: z.string(),
    owner: z.string(),
    repo: z.string(),
    number: z.number(),
  })
  .openapi("GithubClosePrDirectRequest");

const PullRequestDirectResponse = z
  .object({
    success: z.boolean(),
    url: z.string().url().optional(),
    number: z.number(),
    state: z.string(),
    error: z.string().optional(),
  })
  .openapi("GithubPrDirectResponse");

export const githubPrsMergeDirectRouter = new OpenAPIHono();

githubPrsMergeDirectRouter.openapi(
  createRoute({
    method: "post" as const,
    path: "/integrations/github/prs/merge-direct",
    tags: ["Integrations"],
    summary:
      "Merge a GitHub pull request directly by owner/repo/number using the user's GitHub OAuth token",
    request: {
      body: {
        content: {
          "application/json": {
            schema: MergePullRequestDirectBody,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "PR merged",
        content: {
          "application/json": {
            schema: PullRequestDirectResponse,
          },
        },
      },
      400: { description: "Invalid request" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
      404: { description: "Pull request not found" },
      500: { description: "Failed to merge PR" },
    },
  }),
  async (c) => {
    const user = await stackServerAppJs.getUser({ tokenStore: c.req.raw });
    if (!user) {
      return c.text("Unauthorized", 401);
    }

    const [{ accessToken }, githubAccount] = await Promise.all([
      user.getAuthJson(),
      user.getConnectedAccount("github"),
    ]);

    if (!accessToken) {
      return c.text("Unauthorized", 401);
    }

    if (!githubAccount) {
      return c.json(
        {
          success: false,
          number: 0,
          state: "unknown",
          error: "GitHub account is not connected",
        },
        401,
      );
    }

    const { accessToken: githubAccessToken } =
      await githubAccount.getAccessToken();
    if (!githubAccessToken) {
      return c.json(
        {
          success: false,
          number: 0,
          state: "unknown",
          error: "GitHub access token unavailable",
        },
        401,
      );
    }

    const body = c.req.valid("json");
    const { teamSlugOrId, owner, repo, number, method } = body;

    await verifyTeamAccess({ req: c.req.raw, teamSlugOrId });

    const octokit = createOctokit(githubAccessToken);

    try {
      let detail = await fetchPullRequestDetail({
        octokit,
        owner,
        repo,
        number,
      });

      if (!detail) {
        return c.json(
          {
            success: false,
            number,
            state: "unknown",
            error: "Pull request not found",
          },
          404,
        );
      }

      if (detail.draft) {
        await markPullRequestReady({
          octokit,
          owner,
          repo,
          number: detail.number,
          nodeId: detail.node_id,
        });
        detail = await fetchPullRequestDetail({
          octokit,
          owner,
          repo,
          number: detail.number,
        });
      }

      if (
        (detail.state ?? "").toLowerCase() === "closed" &&
        !detail.merged_at
      ) {
        await reopenPullRequest({
          octokit,
          owner,
          repo,
          number: detail.number,
        });
        detail = await fetchPullRequestDetail({
          octokit,
          owner,
          repo,
          number: detail.number,
        });
      }

      const title = `Merged via cmux`;
      const commitMessage = `Merged by cmux user ${user.primaryEmail ?? "unknown"}.`;

      await mergePullRequest({
        octokit,
        owner,
        repo,
        number: detail.number,
        method,
        commitTitle: title,
        commitMessage,
      });

      const mergedDetail = await fetchPullRequestDetail({
        octokit,
        owner,
        repo,
        number: detail.number,
      });

      return c.json({
        success: true,
        url: mergedDetail.html_url,
        number: mergedDetail.number,
        state: mergedDetail.state,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json(
        {
          success: false,
          number,
          state: "unknown",
          error: message,
        },
        500,
      );
    }
  },
);

githubPrsMergeDirectRouter.openapi(
  createRoute({
    method: "post" as const,
    path: "/integrations/github/prs/close-direct",
    tags: ["Integrations"],
    summary:
      "Close a GitHub pull request directly by owner/repo/number using the user's GitHub OAuth token",
    request: {
      body: {
        content: {
          "application/json": {
            schema: ClosePullRequestDirectBody,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "PR closed",
        content: {
          "application/json": {
            schema: PullRequestDirectResponse,
          },
        },
      },
      400: { description: "Invalid request" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
      404: { description: "Pull request not found" },
      500: { description: "Failed to close PR" },
    },
  }),
  async (c) => {
    const user = await stackServerAppJs.getUser({ tokenStore: c.req.raw });
    if (!user) {
      return c.text("Unauthorized", 401);
    }

    const [{ accessToken }, githubAccount] = await Promise.all([
      user.getAuthJson(),
      user.getConnectedAccount("github"),
    ]);

    if (!accessToken) {
      return c.text("Unauthorized", 401);
    }

    if (!githubAccount) {
      return c.json(
        {
          success: false,
          number: 0,
          state: "unknown",
          error: "GitHub account is not connected",
        },
        401,
      );
    }

    const { accessToken: githubAccessToken } =
      await githubAccount.getAccessToken();
    if (!githubAccessToken) {
      return c.json(
        {
          success: false,
          number: 0,
          state: "unknown",
          error: "GitHub access token unavailable",
        },
        401,
      );
    }

    const body = c.req.valid("json");
    const { teamSlugOrId, owner, repo, number } = body;

    await verifyTeamAccess({ req: c.req.raw, teamSlugOrId });

    const octokit = createOctokit(githubAccessToken);

    try {
      const detail = await fetchPullRequestDetail({
        octokit,
        owner,
        repo,
        number,
      });

      if (!detail) {
        return c.json(
          {
            success: false,
            number,
            state: "unknown",
            error: "Pull request not found",
          },
          404,
        );
      }

      if (detail.merged_at) {
        return c.json(
          {
            success: false,
            url: detail.html_url,
            number: detail.number,
            state: "merged",
            error: "Cannot close a merged pull request",
          },
          400,
        );
      }

      if ((detail.state ?? "").toLowerCase() !== "closed") {
        await closePullRequest({
          octokit,
          owner,
          repo,
          number: detail.number,
        });
      }

      const closedDetail = await fetchPullRequestDetail({
        octokit,
        owner,
        repo,
        number: detail.number,
      });

      return c.json({
        success: true,
        url: closedDetail.html_url,
        number: closedDetail.number,
        state: closedDetail.state,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json(
        {
          success: false,
          number,
          state: "unknown",
          error: message,
        },
        500,
      );
    }
  },
);

function createOctokit(token: string): Octokit {
  return new Octokit({
    auth: token,
    request: {
      timeout: 30_000,
    },
    throttle: {
      onRateLimit: (
        retryAfter: number,
        options: OctokitThrottleOptions,
        _octokit: Octokit,
        retryCount: number,
      ) => {
        const maxRetries = 2;
        const maxWaitSeconds = 15;
        if (retryCount < maxRetries && retryAfter <= maxWaitSeconds) {
          console.warn(
            `GitHub rate limit on ${options.method} ${options.url}. Retrying after ${retryAfter}s (retry #${retryCount + 1}).`,
          );
          return true;
        }
        return false;
      },
      onSecondaryRateLimit: (
        retryAfter: number,
        options: OctokitThrottleOptions,
        _octokit: Octokit,
        retryCount: number,
      ) => {
        const maxRetries = 2;
        const maxWaitSeconds = 15;
        if (retryCount < maxRetries && retryAfter <= maxWaitSeconds) {
          console.warn(
            `GitHub secondary rate limit on ${options.method} ${options.url}. Retrying after ${retryAfter}s (retry #${retryCount + 1}).`,
          );
          return true;
        }
        return false;
      },
    },
  });
}

async function fetchPullRequestDetail({
  octokit,
  owner,
  repo,
  number,
}: {
  octokit: Octokit;
  owner: string;
  repo: string;
  number: number;
}): Promise<GitHubPrDetail> {
  const { data } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: number,
  });
  return {
    number: data.number,
    html_url: data.html_url,
    state: data.state,
    draft: data.draft ?? undefined,
    merged_at: data.merged_at,
    node_id: data.node_id,
  };
}

async function markPullRequestReady({
  octokit,
  owner,
  repo,
  number,
  nodeId,
}: {
  octokit: Octokit;
  owner: string;
  repo: string;
  number: number;
  nodeId: string;
}): Promise<void> {
  const { data } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: number,
  });

  if (!data.draft) {
    return;
  }

  const mutation = `
    mutation($pullRequestId: ID!) {
      markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
        pullRequest {
          id
          isDraft
        }
      }
    }
  `;

  await octokit.graphql(mutation, {
    pullRequestId: nodeId || data.node_id,
  });
}

async function reopenPullRequest({
  octokit,
  owner,
  repo,
  number,
}: {
  octokit: Octokit;
  owner: string;
  repo: string;
  number: number;
}): Promise<void> {
  await octokit.rest.pulls.update({
    owner,
    repo,
    pull_number: number,
    state: "open",
  });
}

async function mergePullRequest({
  octokit,
  owner,
  repo,
  number,
  method,
  commitTitle,
  commitMessage,
}: {
  octokit: Octokit;
  owner: string;
  repo: string;
  number: number;
  method: "squash" | "rebase" | "merge";
  commitTitle: string;
  commitMessage: string;
}): Promise<void> {
  await octokit.rest.pulls.merge({
    owner,
    repo,
    pull_number: number,
    merge_method: method,
    commit_title: commitTitle,
    commit_message: commitMessage,
  });
}

async function closePullRequest({
  octokit,
  owner,
  repo,
  number,
}: {
  octokit: Octokit;
  owner: string;
  repo: string;
  number: number;
}): Promise<void> {
  await octokit.rest.pulls.update({
    owner,
    repo,
    pull_number: number,
    state: "closed",
  });
}
