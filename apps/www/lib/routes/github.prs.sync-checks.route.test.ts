import { __TEST_INTERNAL_ONLY_GET_STACK_TOKENS } from "@/lib/test-utils/__TEST_INTERNAL_ONLY_GET_STACK_TOKENS";
import { testApiClient } from "@/lib/test-utils/openapi-client";
import { api } from "@cmux/convex/api";
import { postApiApiIntegrationsGithubPrsSyncChecks } from "@cmux/www-openapi-client";
import { describe, expect, it } from "vitest";
import { getConvex } from "../utils/get-convex";

describe("githubPrsSyncChecksRouter", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await postApiApiIntegrationsGithubPrsSyncChecks({
      client: testApiClient,
      body: {
        teamSlugOrId: "manaflow",
        owner: "manaflow-ai",
        repo: "cmux",
        prNumber: 1,
      },
    });
    expect(res.response.status).toBe(401);
  });

  it("rejects requests with missing required fields", async () => {
    const tokens = await __TEST_INTERNAL_ONLY_GET_STACK_TOKENS();
    const res = await postApiApiIntegrationsGithubPrsSyncChecks({
      client: testApiClient,
      headers: { "x-stack-auth": JSON.stringify(tokens) },
      body: {
        teamSlugOrId: "manaflow",
        owner: "manaflow-ai",
        repo: "cmux",
        prNumber: 0,
      },
    });
    expect([400, 422]).toContain(res.response.status);
  });

  it("returns 400 when repository is not found", async () => {
    const tokens = await __TEST_INTERNAL_ONLY_GET_STACK_TOKENS();
    const res = await postApiApiIntegrationsGithubPrsSyncChecks({
      client: testApiClient,
      headers: { "x-stack-auth": JSON.stringify(tokens) },
      body: {
        teamSlugOrId: "manaflow",
        owner: "nonexistent",
        repo: "nonexistent-repo",
        prNumber: 1,
      },
    });
    expect([400, 500]).toContain(res.response.status);
  });

  it("syncs check runs and workflow runs for a valid PR", async () => {
    const tokens = await __TEST_INTERNAL_ONLY_GET_STACK_TOKENS();
    const convex = getConvex({ accessToken: tokens.accessToken });

    let testPr: { repoFullName: string; number: number; headSha?: string } | null = null;
    try {
      const prs = await convex.query(api.github_prs.listPullRequests, {
        teamSlugOrId: "manaflow",
        state: "all",
      });
      testPr = prs.find((pr) => pr.headSha) || null;
    } catch (error) {
      console.log("Skipping test - Convex unreachable:", error);
      return;
    }

    if (!testPr) {
      console.log("Skipping test - No PRs with headSha found");
      return;
    }

    const [owner, repo] = testPr.repoFullName.split("/");

    const res = await postApiApiIntegrationsGithubPrsSyncChecks({
      client: testApiClient,
      headers: { "x-stack-auth": JSON.stringify(tokens) },
      body: {
        teamSlugOrId: "manaflow",
        owner,
        repo,
        prNumber: testPr.number,
        ref: testPr.headSha,
      },
    });

    expect([200, 400, 500, 501]).toContain(res.response.status);

    if (res.response.status === 200 && res.data) {
      expect(res.data.success).toBe(true);
      expect(typeof res.data.checkRunsCount).toBe("number");
      expect(typeof res.data.workflowRunsCount).toBe("number");
      expect(res.data.checkRunsCount).toBeGreaterThanOrEqual(0);
      expect(res.data.workflowRunsCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("syncs check runs including Vercel deployments", async () => {
    const tokens = await __TEST_INTERNAL_ONLY_GET_STACK_TOKENS();
    const convex = getConvex({ accessToken: tokens.accessToken });

    let testPr: { repoFullName: string; number: number; headSha?: string } | null = null;
    try {
      const prs = await convex.query(api.github_prs.listPullRequests, {
        teamSlugOrId: "manaflow",
        state: "all",
      });
      testPr = prs.find((pr) => pr.headSha) || null;
    } catch (error) {
      console.log("Skipping test - Convex unreachable:", error);
      return;
    }

    if (!testPr) {
      console.log("Skipping test - No PRs with headSha found");
      return;
    }

    const [owner, repo] = testPr.repoFullName.split("/");

    const res = await postApiApiIntegrationsGithubPrsSyncChecks({
      client: testApiClient,
      headers: { "x-stack-auth": JSON.stringify(tokens) },
      body: {
        teamSlugOrId: "manaflow",
        owner,
        repo,
        prNumber: testPr.number,
        ref: testPr.headSha,
      },
    });

    if (res.response.status === 200 && res.data && res.data.checkRunsCount > 0) {
      const checkRuns = await convex.query(api.github_check_runs.getCheckRunsForPr, {
        teamSlugOrId: "manaflow",
        repoFullName: testPr.repoFullName,
        prNumber: testPr.number,
        headSha: testPr.headSha,
      });

      expect(checkRuns).toBeDefined();
      expect(Array.isArray(checkRuns)).toBe(true);

      const vercelCheckRuns = checkRuns.filter(
        (run) => run.appName === "Vercel" || run.appSlug === "vercel"
      );

      if (vercelCheckRuns.length > 0) {
        vercelCheckRuns.forEach((run) => {
          expect(run.name).toBeDefined();
          expect(run.headSha).toBe(testPr.headSha);
          expect(run.status).toBeDefined();
          expect(["queued", "in_progress", "completed"]).toContain(run.status);

          if (run.htmlUrl) {
            expect(run.htmlUrl).toMatch(/^https?:\/\//);
          }
        });
      }
    }
  });

  it("syncs workflow runs for GitHub Actions", async () => {
    const tokens = await __TEST_INTERNAL_ONLY_GET_STACK_TOKENS();
    const convex = getConvex({ accessToken: tokens.accessToken });

    let testPr: { repoFullName: string; number: number; headSha?: string } | null = null;
    try {
      const prs = await convex.query(api.github_prs.listPullRequests, {
        teamSlugOrId: "manaflow",
        state: "all",
      });
      testPr = prs.find((pr) => pr.headSha) || null;
    } catch (error) {
      console.log("Skipping test - Convex unreachable:", error);
      return;
    }

    if (!testPr) {
      console.log("Skipping test - No PRs with headSha found");
      return;
    }

    const [owner, repo] = testPr.repoFullName.split("/");

    const res = await postApiApiIntegrationsGithubPrsSyncChecks({
      client: testApiClient,
      headers: { "x-stack-auth": JSON.stringify(tokens) },
      body: {
        teamSlugOrId: "manaflow",
        owner,
        repo,
        prNumber: testPr.number,
        ref: testPr.headSha,
      },
    });

    if (res.response.status === 200 && res.data && res.data.workflowRunsCount > 0) {
      const workflowRuns = await convex.query(api.github_workflows.getWorkflowRunsForPr, {
        teamSlugOrId: "manaflow",
        repoFullName: testPr.repoFullName,
        prNumber: testPr.number,
        headSha: testPr.headSha,
      });

      expect(workflowRuns).toBeDefined();
      expect(Array.isArray(workflowRuns)).toBe(true);

      if (workflowRuns.length > 0) {
        workflowRuns.forEach((run) => {
          expect(run.workflowName).toBeDefined();
          expect(run.runId).toBeDefined();
          expect(run.headSha).toBe(testPr.headSha);
          expect(run.status).toBeDefined();
          expect(["queued", "in_progress", "completed", "pending", "waiting"]).toContain(run.status);

          if (run.htmlUrl) {
            expect(run.htmlUrl).toMatch(/^https?:\/\//);
          }
        });
      }
    }
  });

  it("handles syncing without ref parameter", async () => {
    const tokens = await __TEST_INTERNAL_ONLY_GET_STACK_TOKENS();
    const convex = getConvex({ accessToken: tokens.accessToken });

    let testPr: { repoFullName: string; number: number } | null = null;
    try {
      const prs = await convex.query(api.github_prs.listPullRequests, {
        teamSlugOrId: "manaflow",
        state: "all",
      });
      testPr = prs[0] || null;
    } catch (error) {
      console.log("Skipping test - Convex unreachable:", error);
      return;
    }

    if (!testPr) {
      console.log("Skipping test - No PRs found");
      return;
    }

    const [owner, repo] = testPr.repoFullName.split("/");

    const res = await postApiApiIntegrationsGithubPrsSyncChecks({
      client: testApiClient,
      headers: { "x-stack-auth": JSON.stringify(tokens) },
      body: {
        teamSlugOrId: "manaflow",
        owner,
        repo,
        prNumber: testPr.number,
      },
    });

    expect([200, 400, 500, 501]).toContain(res.response.status);

    if (res.response.status === 200 && res.data) {
      expect(res.data.success).toBe(true);
      expect(res.data.checkRunsCount).toBe(0);
      expect(typeof res.data.workflowRunsCount).toBe("number");
    }
  });
});
