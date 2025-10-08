import { getAccessTokenFromRequest } from "@/lib/utils/auth";
import { generateGitHubInstallationToken } from "@/lib/utils/github-app-token";
import { api } from "@cmux/convex/api";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { Octokit } from "octokit";
import { getConvex } from "../utils/get-convex";

export const githubChecksBackfillRouter = new OpenAPIHono();

const BackfillChecksBody = z.object({
  teamSlugOrId: z.string().min(1).openapi({ description: "Team slug or UUID" }),
  owner: z.string().min(1).openapi({ description: "Repository owner" }),
  repo: z.string().min(1).openapi({ description: "Repository name" }),
  ref: z.string().optional().openapi({ description: "Git ref (SHA or branch) to fetch checks for" }),
  prNumber: z.number().int().positive().optional().openapi({ description: "Pull request number to fetch checks for" }),
  perPage: z.number().int().positive().max(100).optional().default(100).openapi({ description: "Number of items per page (max 100)" }),
  maxPages: z.number().int().positive().max(10).optional().default(3).openapi({ description: "Maximum number of pages to fetch (max 10)" }),
});

const BackfillChecksResponse = z.object({
  success: z.boolean(),
  checkRunsCount: z.number(),
  workflowRunsCount: z.number(),
  pagesFetched: z.number(),
});

githubChecksBackfillRouter.openapi(
  createRoute({
    method: "post",
    path: "/api/integrations/github/checks/backfill",
    summary: "Backfill historical checks",
    description: "Fetch and persist historical workflow runs and check runs from GitHub for a repository or specific ref/PR",
    request: {
      body: {
        content: {
          "application/json": {
            schema: BackfillChecksBody,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Checks backfilled successfully",
        content: {
          "application/json": {
            schema: BackfillChecksResponse,
          },
        },
      },
      400: {
        description: "Bad request",
      },
      401: {
        description: "Unauthorized",
      },
      500: {
        description: "Internal server error",
      },
    },
  }),
  async (c) => {
    const accessToken = await getAccessTokenFromRequest(c.req.raw);
    if (!accessToken) return c.text("Unauthorized", 401);

    const { teamSlugOrId, owner, repo: repoName, ref, prNumber, perPage, maxPages } = c.req.valid("json");
    const repoFullName = `${owner}/${repoName}`;

    const convex = getConvex({ accessToken });

    try {
      const repoDoc = await convex.query(api.github.getRepoByFullName, {
        teamSlugOrId,
        fullName: repoFullName,
      });

      if (!repoDoc) {
        return c.json({ error: "Repository not found" }, 400);
      }

      const connections = await convex.query(api.github.listProviderConnections, {
        teamSlugOrId,
      });

      type Connection = { _id: string; installationId: number; isActive?: boolean };
      const connection = (connections as unknown as Connection[]).find((c) => c._id === repoDoc.connectionId);

      if (!connection) {
        return c.json({ error: "GitHub connection not found" }, 400);
      }

      const installationId = connection.installationId;

      const githubToken = await generateGitHubInstallationToken({
        installationId,
        repositories: [repoFullName],
        permissions: {
          actions: "read",
          checks: "read",
          metadata: "read",
        },
      });

      const octokit = new Octokit({ auth: githubToken });

      let checkRunsCount = 0;
      let workflowRunsCount = 0;
      let pagesFetched = 0;

      if (ref) {
        console.log(`[backfillChecks] Fetching check runs for ${repoFullName} ref ${ref}`);

        const { data: checkRuns } = await octokit.rest.checks.listForRef({
          owner,
          repo: repoName,
          ref,
          per_page: perPage,
        });

        console.log(`[backfillChecks] Found ${checkRuns.check_runs.length} check runs`);

        if (checkRuns.check_runs.length > 0) {
          await convex.mutation(api.github_check_runs.upsertCheckRunsFromApi, {
            teamSlugOrId,
            repoFullName,
            installationId,
            repositoryId: repoDoc.providerRepoId,
            checkRuns: checkRuns.check_runs,
          });
        }

        checkRunsCount = checkRuns.check_runs.length;
        pagesFetched = 1;
      }

      console.log(`[backfillChecks] Fetching workflow runs for ${repoFullName}`);

      const fetchOptions: {
        owner: string;
        repo: string;
        per_page: number;
        page?: number;
        event?: string;
      } = {
        owner,
        repo: repoName,
        per_page: perPage,
      };

      if (prNumber) {
        fetchOptions.event = "pull_request";
      }

      for (let page = 1; page <= maxPages; page++) {
        const { data: workflowRuns } = await octokit.rest.actions.listWorkflowRunsForRepo({
          ...fetchOptions,
          page,
        });

        if (workflowRuns.workflow_runs.length === 0) {
          console.log(`[backfillChecks] No more workflow runs found at page ${page}`);
          break;
        }

        let relevantWorkflowRuns = workflowRuns.workflow_runs;

        if (prNumber) {
          relevantWorkflowRuns = workflowRuns.workflow_runs.filter((run) => {
            const matchesPr = run.pull_requests?.some((pr) => pr.number === prNumber);
            const matchesRef = ref && run.head_sha === ref;
            return matchesPr || matchesRef;
          });
        } else if (ref) {
          relevantWorkflowRuns = workflowRuns.workflow_runs.filter((run) => run.head_sha === ref);
        }

        console.log(`[backfillChecks] Page ${page}: Found ${relevantWorkflowRuns.length} relevant workflow runs out of ${workflowRuns.workflow_runs.length} total`);

        if (relevantWorkflowRuns.length > 0) {
          await convex.mutation(api.github_workflows.upsertWorkflowRunsFromApi, {
            teamSlugOrId,
            repoFullName,
            installationId,
            repositoryId: repoDoc.providerRepoId,
            workflowRuns: relevantWorkflowRuns,
          });
        }

        workflowRunsCount += relevantWorkflowRuns.length;
        pagesFetched = page;

        if (workflowRuns.workflow_runs.length < perPage) {
          console.log(`[backfillChecks] Reached last page at ${page}`);
          break;
        }
      }

      console.log(`[backfillChecks] Successfully backfilled ${checkRunsCount} check runs and ${workflowRunsCount} workflow runs across ${pagesFetched} pages`);

      return c.json({
        success: true,
        checkRunsCount,
        workflowRunsCount,
        pagesFetched,
      });
    } catch (error) {
      console.error("[backfillChecks] Error backfilling checks:", error);
      return c.json(
        {
          error: "Failed to backfill checks",
          details: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
);
