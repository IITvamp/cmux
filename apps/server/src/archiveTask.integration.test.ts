import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import type { FunctionReturnType } from "convex/server";
import { exec as _exec } from "node:child_process";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { stopContainersForRuns } from "./archiveTask.js";

// Mock the logger to quiet output during tests
vi.mock("./utils/fileLogger.js", () => ({
  serverLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    close: vi.fn(),
  },
  dockerLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    close: vi.fn(),
  },
}));

const execAsync = promisify(_exec);

async function docker(
  cmd: string
): Promise<{ stdout: string; stderr: string }> {
  return execAsync(cmd, { timeout: 30_000 });
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

describe("stopContainersForRuns integration tests", () => {
  const containers: string[] = [];
  const zidRun = typedZid("taskRuns");
  const zidTask = typedZid("tasks");
  const now = Date.now();

  beforeAll(async () => {
    // Ensure image exists
    await docker("docker pull alpine:3");
  }, 120_000);

  afterAll(async () => {
    // Cleanup any leftover containers
    for (const name of containers) {
      try {
        await docker(`docker rm -f ${name}`);
      } catch {
        // ignore
      }
    }
  }, 60_000);

  it("integrates with query function to stop containers for a task", async () => {
    const container1 = `cmux-test-int-1-${randomSuffix()}`;
    const container2 = `cmux-test-int-2-${randomSuffix()}`;
    containers.push(container1, container2);

    // Start two containers
    await docker(`docker run -d --name ${container1} alpine:3 sh -c 'sleep 300'`);
    await docker(`docker run -d --name ${container2} alpine:3 sh -c 'sleep 300'`);

    const taskId = zidTask.parse("t-int-test");

    // Mock query function that returns our test tree
    const mockQuery = vi.fn().mockResolvedValue([
      {
        _id: zidRun.parse("r-int-1"),
        _creationTime: now,
        taskId,
        prompt: "p",
        status: "running",
        log: "",
        createdAt: now,
        updatedAt: now,
        vscode: { provider: "docker", status: "running", containerName: container1 },
        children: [],
      },
      {
        _id: zidRun.parse("r-int-2"),
        _creationTime: now,
        taskId,
        prompt: "p",
        status: "running",
        log: "",
        createdAt: now,
        updatedAt: now,
        vscode: { provider: "docker", status: "running", containerName: container2 },
        children: [],
      },
    ] satisfies FunctionReturnType<typeof api.taskRuns.getByTask>);

    // Test the function with the mock query
    const results = await stopContainersForRuns(taskId, mockQuery);

    // Verify query was called correctly
    expect(mockQuery).toHaveBeenCalledWith(api.taskRuns.getByTask, { taskId });

    // Verify results
    expect(results).toHaveLength(2);
    expect(results.every(r => r.success)).toBe(true);

    // Verify containers are stopped
    const { stdout: state1 } = await docker(
      `docker inspect -f '{{.State.Running}} {{.State.Status}}' ${container1}`
    );
    const { stdout: state2 } = await docker(
      `docker inspect -f '{{.State.Running}} {{.State.Status}}' ${container2}`
    );
    expect(state1.trim()).toMatch(/false\s+(exited|created)/);
    expect(state2.trim()).toMatch(/false\s+(exited|created)/);
  }, 120_000);

  it("handles errors gracefully when query fails", async () => {
    const taskId = zidTask.parse("t-error-test");

    // Mock query function that throws an error
    const mockQuery = vi.fn().mockRejectedValue(new Error("Query failed"));

    // Test that the error is propagated
    await expect(stopContainersForRuns(taskId, mockQuery)).rejects.toThrow("Query failed");
  });

  it("correctly identifies and stops nested containers in tree structure", async () => {
    const parent = `cmux-test-parent-${randomSuffix()}`;
    const child1 = `cmux-test-child1-${randomSuffix()}`;
    const child2 = `cmux-test-child2-${randomSuffix()}`;
    containers.push(parent, child1, child2);

    // Start containers
    await docker(`docker run -d --name ${parent} alpine:3 sh -c 'sleep 300'`);
    await docker(`docker run -d --name ${child1} alpine:3 sh -c 'sleep 300'`);
    await docker(`docker run -d --name ${child2} alpine:3 sh -c 'sleep 300'`);

    const taskId = zidTask.parse("t-nested");

    // Mock query with nested structure
    const mockQuery = vi.fn().mockResolvedValue([
      {
        _id: zidRun.parse("r-parent"),
        _creationTime: now,
        taskId,
        prompt: "p",
        status: "running",
        log: "",
        createdAt: now,
        updatedAt: now,
        vscode: { provider: "docker", status: "running", containerName: parent },
        children: [
          {
            _id: zidRun.parse("r-child1"),
            _creationTime: now,
            taskId,
            prompt: "p",
            status: "running",
            log: "",
            createdAt: now,
            updatedAt: now,
            vscode: { provider: "docker", status: "running", containerName: child1 },
            children: [
              {
                _id: zidRun.parse("r-child2"),
                _creationTime: now,
                taskId,
                prompt: "p",
                status: "running",
                log: "",
                createdAt: now,
                updatedAt: now,
                vscode: { provider: "docker", status: "running", containerName: child2 },
                children: [],
              },
            ],
          },
        ],
      },
    ] satisfies FunctionReturnType<typeof api.taskRuns.getByTask>);

    const results = await stopContainersForRuns(taskId, mockQuery);

    // Should stop all three containers
    expect(results).toHaveLength(3);
    expect(results.every(r => r.success)).toBe(true);

    // Verify all containers are stopped
    for (const containerName of [parent, child1, child2]) {
      const { stdout: state } = await docker(
        `docker inspect -f '{{.State.Running}} {{.State.Status}}' ${containerName}`
      );
      expect(state.trim()).toMatch(/false\s+(exited|created)/);
    }
  }, 120_000);
});