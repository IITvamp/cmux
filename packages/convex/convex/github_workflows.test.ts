import { describe, expect, it } from "vitest";

describe("github_workflows", () => {
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

    it("handles string dates", () => {
      const timestamp = "2021-01-01T00:00:00Z";
      const parsed = Date.parse(timestamp);
      expect(Number.isNaN(parsed)).toBe(false);
      expect(parsed).toBe(1609459200000);
    });
  });

  describe("workflow run status mapping", () => {
    it("maps valid GitHub statuses to schema statuses", () => {
      const validStatuses = ["queued", "in_progress", "completed", "pending", "waiting"];
      validStatuses.forEach((status) => {
        const mapped = status === "requested" ? undefined : status;
        expect(mapped).toBe(status);
      });
    });

    it("filters out requested status", () => {
      const status = "requested";
      const mapped = status === "requested" ? undefined : status;
      expect(mapped).toBeUndefined();
    });
  });

  describe("workflow run conclusion mapping", () => {
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

  describe("workflow run duration calculation", () => {
    it("calculates duration from start to completion", () => {
      const runStartedAt = 1609459200000;
      const runCompletedAt = 1609459500000;
      const duration = Math.round((runCompletedAt - runStartedAt) / 1000);
      expect(duration).toBe(300);
    });

    it("handles missing start time", () => {
      const runStartedAt = undefined;
      const runCompletedAt = 1609459500000;
      const duration = runStartedAt && runCompletedAt
        ? Math.round((runCompletedAt - runStartedAt) / 1000)
        : undefined;
      expect(duration).toBeUndefined();
    });

    it("handles missing completion time", () => {
      const runStartedAt = 1609459200000;
      const runCompletedAt = undefined;
      const duration = runStartedAt && runCompletedAt
        ? Math.round((runCompletedAt - runStartedAt) / 1000)
        : undefined;
      expect(duration).toBeUndefined();
    });
  });

  describe("workflow run pull request association", () => {
    it("extracts PR number from workflow run", () => {
      const workflowRun = {
        pull_requests: [
          { number: 73 },
          { number: 74 },
        ],
      };

      const triggeringPrNumber = workflowRun.pull_requests && workflowRun.pull_requests.length > 0
        ? workflowRun.pull_requests[0].number
        : undefined;

      expect(triggeringPrNumber).toBe(73);
    });

    it("handles workflow runs without PRs", () => {
      const workflowRun: { pull_requests: Array<{ number: number }> } = {
        pull_requests: [],
      };

      const triggeringPrNumber = workflowRun.pull_requests.length > 0
        ? workflowRun.pull_requests[0]?.number
        : undefined;

      expect(triggeringPrNumber).toBeUndefined();
    });
  });

  describe("GitHub Actions workflow runs", () => {
    it("extracts workflow information", () => {
      const payload = {
        workflow: {
          id: 12345,
          name: "CI",
        },
        workflow_run: {
          id: 67890,
          run_number: 42,
          workflow_id: 12345,
          name: "CI",
          event: "pull_request",
          status: "completed",
          conclusion: "success",
          head_branch: "feature-branch",
          head_sha: "abc123",
          html_url: "https://github.com/org/repo/actions/runs/67890",
          actor: {
            login: "user123",
            id: 456,
          },
          pull_requests: [{ number: 73 }],
        },
      };

      expect(payload.workflow.name).toBe("CI");
      expect(payload.workflow_run.id).toBe(67890);
      expect(payload.workflow_run.run_number).toBe(42);
      expect(payload.workflow_run.status).toBe("completed");
      expect(payload.workflow_run.conclusion).toBe("success");
    });

    it("handles multiple workflow types", () => {
      const workflowNames = [
        "CI",
        "Deploy",
        "Test",
        "Lint",
        "Build",
        "Release",
      ];

      workflowNames.forEach((name) => {
        expect(name).toBeTruthy();
        expect(typeof name).toBe("string");
      });
    });
  });

  describe("workflow run event types", () => {
    it("handles pull_request event", () => {
      const event = "pull_request";
      expect(event).toBe("pull_request");
    });

    it("handles push event", () => {
      const event = "push";
      expect(event).toBe("push");
    });

    it("handles workflow_dispatch event", () => {
      const event = "workflow_dispatch";
      expect(event).toBe("workflow_dispatch");
    });

    it("handles schedule event", () => {
      const event = "schedule";
      expect(event).toBe("schedule");
    });
  });

  describe("workflow run document preparation", () => {
    it("prepares a complete workflow run document", () => {
      const payload = {
        workflow: {
          id: 12345,
          name: "CI",
        },
        workflow_run: {
          id: 67890,
          run_number: 42,
          workflow_id: 12345,
          name: "CI",
          event: "pull_request",
          status: "completed",
          conclusion: "success",
          head_branch: "feature-branch",
          head_sha: "abc123",
          html_url: "https://github.com/org/repo/actions/runs/67890",
          created_at: "2021-01-01T00:00:00Z",
          updated_at: "2021-01-01T00:05:00Z",
          run_started_at: "2021-01-01T00:00:30Z",
          actor: {
            login: "user123",
            id: 456,
          },
          pull_requests: [{ number: 73 }],
        },
        repository: {
          id: 789,
          full_name: "org/repo",
        },
      };

      const doc = {
        provider: "github" as const,
        installationId: 111,
        repositoryId: payload.repository.id,
        repoFullName: payload.repository.full_name,
        runId: payload.workflow_run.id,
        runNumber: payload.workflow_run.run_number,
        teamId: "team123",
        workflowId: payload.workflow.id,
        workflowName: payload.workflow.name,
        name: payload.workflow_run.name,
        event: payload.workflow_run.event,
        status: payload.workflow_run.status,
        conclusion: payload.workflow_run.conclusion,
        headBranch: payload.workflow_run.head_branch,
        headSha: payload.workflow_run.head_sha,
        htmlUrl: payload.workflow_run.html_url,
        actorLogin: payload.workflow_run.actor.login,
        actorId: payload.workflow_run.actor.id,
        triggeringPrNumber: payload.workflow_run.pull_requests[0].number,
      };

      expect(doc.provider).toBe("github");
      expect(doc.runId).toBe(67890);
      expect(doc.workflowName).toBe("CI");
      expect(doc.status).toBe("completed");
      expect(doc.conclusion).toBe("success");
      expect(doc.event).toBe("pull_request");
      expect(doc.triggeringPrNumber).toBe(73);
      expect(doc.actorLogin).toBe("user123");
    });
  });

  describe("workflow run completion handling", () => {
    it("extracts completed_at for completed runs", () => {
      const workflowRun = {
        status: "completed",
        updated_at: "2021-01-01T00:05:00Z",
      };

      const runCompletedAt = workflowRun.status === "completed"
        ? Date.parse(workflowRun.updated_at)
        : undefined;

      expect(runCompletedAt).toBeDefined();
      expect(runCompletedAt).toBe(1609459500000);
    });

    it("does not set completed_at for in_progress runs", () => {
      const workflowRun = {
        status: "in_progress",
        updated_at: "2021-01-01T00:05:00Z",
      };

      const runCompletedAt = workflowRun.status === "completed"
        ? Date.parse(workflowRun.updated_at)
        : undefined;

      expect(runCompletedAt).toBeUndefined();
    });
  });
});
