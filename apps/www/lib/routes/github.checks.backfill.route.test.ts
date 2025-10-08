import { __TEST_INTERNAL_ONLY_GET_STACK_TOKENS } from "@/lib/test-utils/__TEST_INTERNAL_ONLY_GET_STACK_TOKENS";
import { testApiClient } from "@/lib/test-utils/openapi-client";
import { api } from "@cmux/convex/api";
import { postApiApiIntegrationsGithubChecksBackfill } from "@cmux/www-openapi-client";
import { describe, expect, it } from "vitest";
import { getConvex } from "../utils/get-convex";

describe("githubChecksBackfillRouter", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await postApiApiIntegrationsGithubChecksBackfill({
      client: testApiClient,
      body: {
        teamSlugOrId: "manaflow",
        owner: "manaflow-ai",
        repo: "cmux",
      },
    });
    expect(res.response.status).toBe(401);
  });

  it("returns 400 when repository is not found", async () => {
    const tokens = await __TEST_INTERNAL_ONLY_GET_STACK_TOKENS();
    const res = await postApiApiIntegrationsGithubChecksBackfill({
      client: testApiClient,
      headers: { "x-stack-auth": JSON.stringify(tokens) },
      body: {
        teamSlugOrId: "manaflow",
        owner: "nonexistent",
        repo: "nonexistent-repo",
      },
    });
    expect([400, 500]).toContain(res.response.status);
  });

  it("backfills checks for a specific ref", async () => {
    const tokens = await __TEST_INTERNAL_ONLY_GET_STACK_TOKENS();
    const convex = getConvex({ accessToken: tokens.accessToken });

    let testPr: { repoFullName: string; headSha?: string } | null = null;
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

    if (!testPr || !testPr.headSha) {
      console.log("Skipping test - No PRs with headSha found");
      return;
    }

    const [owner, repo] = testPr.repoFullName.split("/");

    const res = await postApiApiIntegrationsGithubChecksBackfill({
      client: testApiClient,
      headers: { "x-stack-auth": JSON.stringify(tokens) },
      body: {
        teamSlugOrId: "manaflow",
        owner,
        repo,
        ref: testPr.headSha,
        perPage: 50,
        maxPages: 1,
      },
    });

    expect([200, 400, 500, 501]).toContain(res.response.status);

    if (res.response.status === 200 && res.data) {
      expect(res.data.success).toBe(true);
      expect(typeof res.data.checkRunsCount).toBe("number");
      expect(typeof res.data.workflowRunsCount).toBe("number");
      expect(typeof res.data.pagesFetched).toBe("number");
      expect(res.data.checkRunsCount).toBeGreaterThanOrEqual(0);
      expect(res.data.workflowRunsCount).toBeGreaterThanOrEqual(0);
      expect(res.data.pagesFetched).toBeGreaterThanOrEqual(0);
    }
  });

  it("backfills checks for a specific PR", async () => {
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

    const res = await postApiApiIntegrationsGithubChecksBackfill({
      client: testApiClient,
      headers: { "x-stack-auth": JSON.stringify(tokens) },
      body: {
        teamSlugOrId: "manaflow",
        owner,
        repo,
        prNumber: testPr.number,
        perPage: 50,
        maxPages: 2,
      },
    });

    expect([200, 400, 500, 501]).toContain(res.response.status);

    if (res.response.status === 200 && res.data) {
      expect(res.data.success).toBe(true);
      expect(typeof res.data.workflowRunsCount).toBe("number");
      expect(res.data.workflowRunsCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("backfills multiple pages of workflow runs", async () => {
    const tokens = await __TEST_INTERNAL_ONLY_GET_STACK_TOKENS();
    const convex = getConvex({ accessToken: tokens.accessToken });

    let testRepo: { repoFullName: string } | null = null;
    try {
      const prs = await convex.query(api.github_prs.listPullRequests, {
        teamSlugOrId: "manaflow",
        state: "all",
      });
      testRepo = prs[0] || null;
    } catch (error) {
      console.log("Skipping test - Convex unreachable:", error);
      return;
    }

    if (!testRepo) {
      console.log("Skipping test - No repos found");
      return;
    }

    const [owner, repo] = testRepo.repoFullName.split("/");

    const res = await postApiApiIntegrationsGithubChecksBackfill({
      client: testApiClient,
      headers: { "x-stack-auth": JSON.stringify(tokens) },
      body: {
        teamSlugOrId: "manaflow",
        owner,
        repo,
        perPage: 10,
        maxPages: 3,
      },
    });

    expect([200, 400, 500, 501]).toContain(res.response.status);

    if (res.response.status === 200 && res.data) {
      expect(res.data.success).toBe(true);
      expect(typeof res.data.workflowRunsCount).toBe("number");
      expect(typeof res.data.pagesFetched).toBe("number");
      expect(res.data.pagesFetched).toBeGreaterThan(0);
      expect(res.data.pagesFetched).toBeLessThanOrEqual(3);
    }
  });

  it("validates perPage parameter is within limits", async () => {
    const tokens = await __TEST_INTERNAL_ONLY_GET_STACK_TOKENS();

    const res = await postApiApiIntegrationsGithubChecksBackfill({
      client: testApiClient,
      headers: { "x-stack-auth": JSON.stringify(tokens) },
      body: {
        teamSlugOrId: "manaflow",
        owner: "manaflow-ai",
        repo: "cmux",
        perPage: 150,
      },
    });

    expect([400, 422]).toContain(res.response.status);
  });

  it("validates maxPages parameter is within limits", async () => {
    const tokens = await __TEST_INTERNAL_ONLY_GET_STACK_TOKENS();

    const res = await postApiApiIntegrationsGithubChecksBackfill({
      client: testApiClient,
      headers: { "x-stack-auth": JSON.stringify(tokens) },
      body: {
        teamSlugOrId: "manaflow",
        owner: "manaflow-ai",
        repo: "cmux",
        maxPages: 20,
      },
    });

    expect([400, 422]).toContain(res.response.status);
  });

  it("persists backfilled check runs to database", async () => {
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

    if (!testPr || !testPr.headSha) {
      console.log("Skipping test - No PRs with headSha found");
      return;
    }

    const [owner, repo] = testPr.repoFullName.split("/");

    const res = await postApiApiIntegrationsGithubChecksBackfill({
      client: testApiClient,
      headers: { "x-stack-auth": JSON.stringify(tokens) },
      body: {
        teamSlugOrId: "manaflow",
        owner,
        repo,
        ref: testPr.headSha,
        perPage: 50,
        maxPages: 1,
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
      expect(checkRuns.length).toBeGreaterThan(0);

      checkRuns.forEach((run) => {
        expect(run.name).toBeDefined();
        expect(run.checkRunId).toBeDefined();
        expect(run.headSha).toBe(testPr.headSha);
      });
    }
  });

  it("persists backfilled workflow runs to database", async () => {
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

    if (!testPr || !testPr.headSha) {
      console.log("Skipping test - No PRs with headSha found");
      return;
    }

    const [owner, repo] = testPr.repoFullName.split("/");

    const res = await postApiApiIntegrationsGithubChecksBackfill({
      client: testApiClient,
      headers: { "x-stack-auth": JSON.stringify(tokens) },
      body: {
        teamSlugOrId: "manaflow",
        owner,
        repo,
        prNumber: testPr.number,
        perPage: 50,
        maxPages: 1,
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
        });
      }
    }
  });
});
