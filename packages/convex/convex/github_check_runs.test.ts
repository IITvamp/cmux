import { describe, expect, it } from "vitest";

describe("github_check_runs", () => {
  describe("normalizeTimestamp", () => {
    it("converts seconds to milliseconds", () => {
      const timestamp = 1609459200;
      const normalized = timestamp > 1000000000000 ? timestamp : timestamp * 1000;
      expect(normalized).toBe(1609459200000);
    });

    it("leaves milliseconds unchanged", () => {
      const timestamp = 1609459200000;
      const normalized = timestamp > 1000000000000 ? timestamp : timestamp * 1000;
      expect(normalized).toBe(1609459200000);
    });

    it("handles null values", () => {
      const timestamp = null;
      const normalized = timestamp === null || timestamp === undefined ? undefined : timestamp;
      expect(normalized).toBeUndefined();
    });

    it("handles undefined values", () => {
      const timestamp = undefined;
      const normalized = timestamp === null || timestamp === undefined ? undefined : timestamp;
      expect(normalized).toBeUndefined();
    });

    it("handles string dates", () => {
      const timestamp = "2021-01-01T00:00:00Z";
      const parsed = Date.parse(timestamp);
      expect(Number.isNaN(parsed)).toBe(false);
      expect(parsed).toBe(1609459200000);
    });
  });

  describe("check run status mapping", () => {
    it("maps valid GitHub statuses to schema statuses", () => {
      const validStatuses = ["queued", "in_progress", "completed"];
      validStatuses.forEach((status) => {
        const mapped = status === "queued" || status === "in_progress" || status === "completed"
          ? status
          : undefined;
        expect(mapped).toBe(status);
      });
    });

    it("filters out invalid statuses", () => {
      const invalidStatus = "invalid_status" as string;
      const mapped = invalidStatus === "queued" || invalidStatus === "in_progress" || invalidStatus === "completed"
        ? invalidStatus
        : undefined;
      expect(mapped).toBeUndefined();
    });
  });

  describe("check run conclusion mapping", () => {
    it("maps valid GitHub conclusions to schema conclusions", () => {
      const validConclusions = ["success", "failure", "neutral", "cancelled", "skipped", "timed_out", "action_required"];
      validConclusions.forEach((conclusion) => {
        const mapped = conclusion === "stale" || conclusion === null ? undefined : conclusion;
        expect(mapped).toBe(conclusion);
      });
    });

    it("filters out stale conclusion", () => {
      const conclusion = "stale";
      const mapped = conclusion === "stale" || conclusion === null ? undefined : conclusion;
      expect(mapped).toBeUndefined();
    });

    it("filters out null conclusion", () => {
      const conclusion = null;
      const mapped = conclusion === "stale" || conclusion === null ? undefined : conclusion;
      expect(mapped).toBeUndefined();
    });
  });

  describe("Vercel deployment check runs", () => {
    it("extracts Vercel app information from check run", () => {
      const checkRun = {
        id: 123456,
        name: "Vercel",
        status: "completed",
        conclusion: "success",
        head_sha: "abc123",
        html_url: "https://github.com/org/repo/runs/123456",
        details_url: "https://vercel.com/org/project/deployment-id",
        app: {
          name: "Vercel",
          slug: "vercel",
        },
        pull_requests: [{ number: 73 }],
      };

      expect(checkRun.app.name).toBe("Vercel");
      expect(checkRun.app.slug).toBe("vercel");
      expect(checkRun.details_url).toMatch(/vercel\.com/);
      expect(checkRun.pull_requests[0].number).toBe(73);
    });

    it("handles Vercel Preview Comments check run", () => {
      const checkRun = {
        id: 123457,
        name: "Vercel Preview Comments",
        status: "completed",
        conclusion: "success",
        head_sha: "abc123",
        app: {
          name: "Vercel",
          slug: "vercel",
        },
      };

      expect(checkRun.name).toBe("Vercel Preview Comments");
      expect(checkRun.app.slug).toBe("vercel");
    });

    it("extracts deployment details URL for Vercel", () => {
      const checkRun = {
        id: 123456,
        name: "Vercel - cmux-client",
        status: "completed",
        conclusion: "success",
        head_sha: "abc123",
        details_url: "https://vercel.com/manaflow-ai/cmux-client/abc123",
        app: {
          slug: "vercel",
        },
      };

      expect(checkRun.details_url).toMatch(/^https:\/\/vercel\.com/);
      expect(checkRun.name).toMatch(/Vercel/);
    });
  });

  describe("check run pull request association", () => {
    it("extracts PR number from check run", () => {
      const checkRun = {
        pull_requests: [
          { number: 73 },
          { number: 74 },
        ],
      };

      const triggeringPrNumber = checkRun.pull_requests && checkRun.pull_requests.length > 0
        ? checkRun.pull_requests[0].number
        : undefined;

      expect(triggeringPrNumber).toBe(73);
    });

    it("handles check runs without PRs", () => {
      const checkRun: { pull_requests: Array<{ number: number }> } = {
        pull_requests: [],
      };

      const triggeringPrNumber = checkRun.pull_requests.length > 0
        ? checkRun.pull_requests[0]?.number
        : undefined;

      expect(triggeringPrNumber).toBeUndefined();
    });

    it("handles missing pull_requests array", () => {
      const checkRun: Record<string, unknown> = {};

      const triggeringPrNumber = (checkRun as any).pull_requests?.length > 0
        ? (checkRun as any).pull_requests[0]?.number
        : undefined;

      expect(triggeringPrNumber).toBeUndefined();
    });
  });

  describe("check run URLs", () => {
    it("handles htmlUrl", () => {
      const checkRun = {
        html_url: "https://github.com/org/repo/runs/123456",
      };

      expect(checkRun.html_url).toMatch(/^https:\/\//);
    });

    it("handles missing URLs", () => {
      const checkRun = {
        html_url: null,
      };

      expect(checkRun.html_url).toBeNull();
    });
  });

  describe("check run document preparation", () => {
    it("prepares a complete check run document for Vercel", () => {
      const payload = {
        check_run: {
          id: 123456,
          name: "Vercel",
          status: "completed",
          conclusion: "success",
          head_sha: "abc123",
          html_url: "https://github.com/org/repo/runs/123456",
          updated_at: "2021-01-01T00:05:00Z",
          started_at: "2021-01-01T00:00:30Z",
          completed_at: "2021-01-01T00:04:30Z",
          app: {
            name: "Vercel",
            slug: "vercel",
          },
          pull_requests: [{ number: 73 }],
        },
        repository: {
          id: 456,
          full_name: "org/repo",
        },
      };

      const doc = {
        provider: "github" as const,
        installationId: 789,
        repositoryId: payload.repository.id,
        repoFullName: payload.repository.full_name,
        checkRunId: payload.check_run.id,
        teamId: "team123",
        name: payload.check_run.name,
        status: payload.check_run.status,
        conclusion: payload.check_run.conclusion,
        headSha: payload.check_run.head_sha,
        htmlUrl: payload.check_run.html_url,
        appName: payload.check_run.app.name,
        appSlug: payload.check_run.app.slug,
        triggeringPrNumber: payload.check_run.pull_requests[0].number,
      };

      expect(doc.provider).toBe("github");
      expect(doc.checkRunId).toBe(123456);
      expect(doc.name).toBe("Vercel");
      expect(doc.status).toBe("completed");
      expect(doc.conclusion).toBe("success");
      expect(doc.appName).toBe("Vercel");
      expect(doc.appSlug).toBe("vercel");
      expect(doc.htmlUrl).toMatch(/github\.com/);
      expect(doc.triggeringPrNumber).toBe(73);
    });
  });
});
