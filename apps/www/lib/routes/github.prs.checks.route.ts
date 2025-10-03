import { verifyTeamAccess } from "@/lib/utils/team-verification";
import { stackServerAppJs } from "@/lib/utils/stack";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { Octokit } from "octokit";

const GetPrChecksParams = z
  .object({
    owner: z.string(),
    repo: z.string(),
    ref: z.string(),
  })
  .openapi("GetPrChecksParams");

const CheckRunSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: z.string(),
  conclusion: z.string().nullable(),
  html_url: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
});

const CommitStatusSchema = z.object({
  id: z.number(),
  state: z.string(),
  description: z.string().nullable(),
  context: z.string(),
  target_url: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const GetPrChecksResponse = z
  .object({
    checkRuns: z.array(CheckRunSchema),
    commitStatuses: z.array(CommitStatusSchema),
    totalCount: z.number(),
    conclusion: z.enum(["success", "failure", "pending", "neutral"]),
  })
  .openapi("GetPrChecksResponse");

export const githubPrsChecksRouter = new OpenAPIHono();

githubPrsChecksRouter.openapi(
  createRoute({
    method: "get" as const,
    path: "/integrations/github/prs/checks",
    tags: ["Integrations"],
    summary: "Get GitHub PR checks and commit statuses",
    request: {
      query: GetPrChecksParams,
    },
    responses: {
      200: {
        description: "PR checks retrieved",
        content: {
          "application/json": {
            schema: GetPrChecksResponse,
          },
        },
      },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
      500: { description: "Failed to fetch PR checks" },
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

    if (!accessToken || !githubAccount) {
      return c.text("Unauthorized", 401);
    }

    const { accessToken: githubAccessToken } =
      await githubAccount.getAccessToken();
    if (!githubAccessToken) {
      return c.text("Unauthorized", 401);
    }

    const { owner, repo, ref } = c.req.valid("query");

    // Extract teamSlugOrId from headers or default
    const teamSlugOrId = c.req.header("x-team-slug-or-id");
    if (teamSlugOrId) {
      await verifyTeamAccess({ req: c.req.raw, teamSlugOrId });
    }

    try {
      const octokit = new Octokit({ auth: githubAccessToken });

      // Fetch check runs
      const checkRunsResponse = await octokit.rest.checks.listForRef({
        owner,
        repo,
        ref,
        per_page: 100,
      });

      // Fetch commit statuses
      const statusesResponse = await octokit.rest.repos.getCombinedStatusForRef(
        {
          owner,
          repo,
          ref,
          per_page: 100,
        }
      );

      const checkRuns = checkRunsResponse.data.check_runs.map((run) => ({
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        html_url: run.html_url,
        started_at: run.started_at,
        completed_at: run.completed_at,
      }));

      const commitStatuses = statusesResponse.data.statuses.map((status) => ({
        id: status.id,
        state: status.state,
        description: status.description,
        context: status.context,
        target_url: status.target_url,
        created_at: status.created_at,
        updated_at: status.updated_at,
      }));

      // Determine overall conclusion
      let conclusion: "success" | "failure" | "pending" | "neutral" = "success";

      const hasFailedCheckRuns = checkRuns.some(
        (run) => run.conclusion === "failure" || run.conclusion === "cancelled"
      );
      const hasPendingCheckRuns = checkRuns.some(
        (run) => run.status !== "completed"
      );
      const hasFailedStatuses = commitStatuses.some(
        (status) => status.state === "error" || status.state === "failure"
      );
      const hasPendingStatuses = commitStatuses.some(
        (status) => status.state === "pending"
      );

      if (hasFailedCheckRuns || hasFailedStatuses) {
        conclusion = "failure";
      } else if (hasPendingCheckRuns || hasPendingStatuses) {
        conclusion = "pending";
      } else if (
        checkRuns.length === 0 &&
        commitStatuses.length === 0
      ) {
        conclusion = "neutral";
      }

      return c.json({
        checkRuns,
        commitStatuses,
        totalCount: checkRuns.length + commitStatuses.length,
        conclusion,
      });
    } catch (error) {
      console.error("[github-checks] Error fetching PR checks:", error);
      const message = error instanceof Error ? error.message : String(error);
      return c.json(
        {
          checkRuns: [],
          commitStatuses: [],
          totalCount: 0,
          conclusion: "neutral" as const,
          error: message,
        },
        500
      );
    }
  }
);
