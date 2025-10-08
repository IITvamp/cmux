import { getAccessTokenFromRequest } from "@/lib/utils/auth";
import { generateGitHubInstallationToken } from "@/lib/utils/github-app-token";
import { api } from "@cmux/convex/api";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { Octokit } from "octokit";
import { getConvex } from "../utils/get-convex";

export const githubPrsSyncChecksRouter = new OpenAPIHono();

const SyncChecksBody = z.object({
  teamSlugOrId: z.string().min(1).openapi({ description: "Team slug or UUID" }),
  owner: z.string().min(1).openapi({ description: "Repository owner" }),
  repo: z.string().min(1).openapi({ description: "Repository name" }),
  prNumber: z.number().int().positive().openapi({ description: "Pull request number" }),
  ref: z.string().optional().openapi({ description: "Git ref (SHA) to fetch checks for" }),
});

const SyncChecksResponse = z.object({
  success: z.boolean(),
  checkRunsCount: z.number(),
  workflowRunsCount: z.number(),
});

githubPrsSyncChecksRouter.openapi(
  createRoute({
    method: "post",
    path: "/api/integrations/github/prs/sync-checks",
    summary: "Sync checks for a PR",
    description: "Fetch and sync workflow runs and check runs from GitHub for a specific PR",
    request: {
      body: {
        content: {
          "application/json": {
            schema: SyncChecksBody,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Checks synced successfully",
        content: {
          "application/json": {
            schema: SyncChecksResponse,
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

    const { teamSlugOrId, owner, repo: repoName, prNumber, ref } = c.req.valid("json");
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

      if (ref) {
        console.log(`[syncChecks] Fetching check runs for ${repoFullName} PR #${prNumber} ref ${ref}`);

        const { data: checkRuns } = await octokit.rest.checks.listForRef({
          owner,
          repo: repoName,
          ref,
          per_page: 100,
        });

        console.log(`[syncChecks] Found ${checkRuns.check_runs.length} check runs`);

        await convex.mutation(api.github_check_runs.upsertCheckRunsFromApi, {
          teamSlugOrId,
          repoFullName,
          installationId,
          repositoryId: repoDoc.providerRepoId,
          checkRuns: checkRuns.check_runs,
        });

        checkRunsCount = checkRuns.check_runs.length;
      }

      console.log(`[syncChecks] Fetching workflow runs for ${repoFullName} PR #${prNumber}`);

      const { data: workflowRuns } = await octokit.rest.actions.listWorkflowRunsForRepo({
        owner,
        repo: repoName,
        per_page: 100,
        event: "pull_request",
      });

      const relevantWorkflowRuns = workflowRuns.workflow_runs.filter((run) => {
        const matchesPr = run.pull_requests?.some((pr) => pr.number === prNumber);
        const matchesRef = ref && run.head_sha === ref;
        return matchesPr || matchesRef;
      });

      console.log(`[syncChecks] Found ${relevantWorkflowRuns.length} relevant workflow runs out of ${workflowRuns.workflow_runs.length} total`);

      if (relevantWorkflowRuns.length > 0) {
        await convex.mutation(api.github_workflows.upsertWorkflowRunsFromApi, {
          teamSlugOrId,
          repoFullName,
          installationId,
          repositoryId: repoDoc.providerRepoId,
          workflowRuns: relevantWorkflowRuns,
        });
      }

      workflowRunsCount = relevantWorkflowRuns.length;

      console.log(`[syncChecks] Successfully synced ${checkRunsCount} check runs and ${workflowRunsCount} workflow runs`);

      return c.json({
        success: true,
        checkRunsCount,
        workflowRunsCount,
      });
    } catch (error) {
      console.error("[syncChecks] Error syncing checks:", error);
      return c.json(
        {
          error: "Failed to sync checks",
          details: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
);
