import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import type { FunctionReturnType } from "convex/server";
import { exec as _exec } from "node:child_process";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { stopContainersForRunsFromTree } from "./archiveTask.js";

// Quiet logger output during tests
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

describe.sequential("stopContainersForRuns (docker E2E)", () => {
  const containers: string[] = [];
  const zidRun = typedZid("taskRuns");
  const zidTask = typedZid("tasks");
  const now = Date.now();

  beforeAll(async () => {
    // Ensure image exists; pull is idempotent
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

  it("stops running containers and treats exited as success", async () => {
    const runA = `cmux-test-a-${randomSuffix()}`;
    const runB = `cmux-test-b-${randomSuffix()}`;
    const alreadyExited = `cmux-test-exited-${randomSuffix()}`;
    containers.push(runA, runB, alreadyExited);

    // Start two long-running containers
    await docker(`docker run -d --name ${runA} alpine:3 sh -c 'sleep 300'`);
    await docker(`docker run -d --name ${runB} alpine:3 sh -c 'sleep 300'`);
    // Create an exited container
    await docker(`docker run --name ${alreadyExited} alpine:3 sh -c 'true'`);

    const tree = [
      {
        _id: zidRun.parse("r1"),
        _creationTime: now,
        taskId: zidTask.parse("t-e2e"),
        prompt: "p",
        status: "running",
        log: "",
        createdAt: now,
        updatedAt: now,
        vscode: { provider: "docker", status: "running", containerName: runA },
        children: [
          {
            _id: zidRun.parse("r2"),
            _creationTime: now,
            taskId: zidTask.parse("t-e2e"),
            prompt: "p",
            status: "running",
            log: "",
            createdAt: now,
            updatedAt: now,
            vscode: {
              provider: "docker",
              status: "stopped",
              containerName: alreadyExited,
            },
            children: [],
          },
        ],
      },
      {
        _id: zidRun.parse("r3"),
        _creationTime: now,
        taskId: zidTask.parse("t-e2e"),
        prompt: "p",
        status: "running",
        log: "",
        createdAt: now,
        updatedAt: now,
        vscode: { provider: "docker", status: "running", containerName: runB },
        children: [],
      },
    ] satisfies FunctionReturnType<typeof api.taskRuns.getByTask>;

    const results = await stopContainersForRunsFromTree(tree, "t-e2e");

    // All three should be reported success
    expect(results.every((r) => r.success)).toBe(true);

    // Verify stopped state for runA and runB
    const { stdout: aState } = await docker(
      `docker inspect -f '{{.State.Running}} {{.State.Status}}' ${runA}`
    );
    const { stdout: bState } = await docker(
      `docker inspect -f '{{.State.Running}} {{.State.Status}}' ${runB}`
    );
    expect(aState.trim()).toMatch(/false\s+(exited|created)/);
    expect(bState.trim()).toMatch(/false\s+(exited|created)/);
  }, 120_000);

  it("returns failure for non-existent containers", async () => {
    const missing = `cmux-test-missing-${randomSuffix()}`;

    const treeMissing = [
      {
        _id: zidRun.parse("r4"),
        _creationTime: now,
        taskId: zidTask.parse("t-missing"),
        prompt: "p",
        status: "running",
        log: "",
        createdAt: now,
        updatedAt: now,
        vscode: { provider: "docker", status: "running", containerName: missing },
        children: [],
      },
    ] satisfies FunctionReturnType<typeof api.taskRuns.getByTask>;

    const results = await stopContainersForRunsFromTree(treeMissing, "t-missing");
    expect(results[0]?.success).toBe(false);
  }, 60_000);

  it("handles multiple containers including non-existent ones", async () => {
    const existing = `cmux-test-exist-${randomSuffix()}`;
    const missing1 = `docker-cmux-jn779kkrf8wb`;
    const missing2 = `docker-cmux-jn76ybndmhcm`;
    const missing3 = `docker-cmux-jn79e83w7d77`;
    containers.push(existing);

    // Start one real container
    await docker(`docker run -d --name ${existing} alpine:3 sh -c 'sleep 300'`);

    // Tree with both existing and non-existent containers
    const tree = [
      {
        _id: zidRun.parse("r5"),
        _creationTime: now,
        taskId: zidTask.parse("t-mixed"),
        prompt: "p",
        status: "running",
        log: "",
        createdAt: now,
        updatedAt: now,
        vscode: { provider: "docker", status: "running", containerName: existing },
        children: [],
      },
      {
        _id: zidRun.parse("r6"),
        _creationTime: now,
        taskId: zidTask.parse("t-mixed"),
        prompt: "p",
        status: "running",
        log: "",
        createdAt: now,
        updatedAt: now,
        vscode: { provider: "docker", status: "running", containerName: missing1 },
        children: [],
      },
      {
        _id: zidRun.parse("r7"),
        _creationTime: now,
        taskId: zidTask.parse("t-mixed"),
        prompt: "p",
        status: "running",
        log: "",
        createdAt: now,
        updatedAt: now,
        vscode: { provider: "docker", status: "running", containerName: missing2 },
        children: [],
      },
      {
        _id: zidRun.parse("r8"),
        _creationTime: now,
        taskId: zidTask.parse("t-mixed"),
        prompt: "p",
        status: "running",
        log: "",
        createdAt: now,
        updatedAt: now,
        vscode: { provider: "docker", status: "running", containerName: missing3 },
        children: [],
      },
    ] satisfies FunctionReturnType<typeof api.taskRuns.getByTask>;

    const results = await stopContainersForRunsFromTree(tree, "t-mixed");
    
    // Should have 4 results
    expect(results).toHaveLength(4);
    
    // Check that the existing container was stopped successfully
    const existingResult = results.find(r => r.containerName === existing);
    expect(existingResult?.success).toBe(true);
    
    // Check that the missing containers failed
    const missingResults = results.filter(r => 
      [missing1, missing2, missing3].includes(r.containerName)
    );
    expect(missingResults).toHaveLength(3);
    expect(missingResults.every(r => !r.success)).toBe(true);
    
    // Verify the existing container is actually stopped
    const { stdout: state } = await docker(
      `docker inspect -f '{{.State.Running}} {{.State.Status}}' ${existing}`
    );
    expect(state.trim()).toMatch(/false\s+(exited|created)/);
  }, 120_000);
});
