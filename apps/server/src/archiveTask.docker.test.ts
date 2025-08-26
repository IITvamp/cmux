import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import type { FunctionReturnType } from "convex/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock file logging to keep tests quiet
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

// Provide a configurable mock for child_process.exec used by promisify(exec)
const execMock = vi.fn(
  (
    cmd: string,
    optionsOrCb: unknown,
    maybeCb?: (err: unknown, stdout?: string, stderr?: string) => void
  ) => {
    const cb = (typeof optionsOrCb === "function"
      ? (optionsOrCb as (err: unknown, stdout?: string, stderr?: string) => void)
      : maybeCb) as (err: unknown, stdout?: string, stderr?: string) => void;
    // The handler will be set per-test below
    handlers.handle(cmd, cb);
  }
);

const handlers: {
  handle: (
    cmd: string,
    cb: (err: unknown, stdout?: string, stderr?: string) => void
  ) => void;
} = {
  handle: (_cmd, cb) => cb(null, "", ""),
};

vi.mock("node:child_process", () => ({
  exec: execMock,
  testing: { execMock, handlers },
}));

import * as childProc from "node:child_process";
import { stopContainersForRunsFromTree } from "./archiveTask.js";

const makeDockerTree = (
  containerName: string
): FunctionReturnType<typeof api.taskRuns.getByTask> => {
  const zidRun = typedZid("taskRuns");
  const zidTask = typedZid("tasks");
  const now = Date.now();
  return [
    {
      _id: zidRun.parse("rm_docker_1"),
      _creationTime: now,
      taskId: zidTask.parse("tm_docker_1"),
      prompt: "p",
      status: "running",
      log: "",
      createdAt: now,
      updatedAt: now,
      vscode: {
        provider: "docker",
        status: "running",
        containerName,
      },
      children: [],
    },
  ];
};

describe("stopContainersForRunsFromTree - docker path", () => {
  beforeEach(() => {
    execMock.mockClear();
  });

  it("stops docker container for docker provider runs", async () => {
    const containerName = "docker-cmux-test-123";
    const tree = makeDockerTree(containerName);

    // First command: docker stop -> succeed
    handlers.handle = (cmd, cb) => {
      if (cmd.startsWith("docker stop ")) {
        cb(null, "Stopped\n", "");
      } else {
        cb(new Error(`Unexpected command: ${cmd}`));
      }
    };

    const results = await stopContainersForRunsFromTree(tree, "tm_docker_1");
    expect(results).toHaveLength(1);
    expect(results[0]?.success).toBe(true);

    expect(execMock).toHaveBeenCalledTimes(1);
    const [firstCmd] = (execMock as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0] as [string];
    expect(firstCmd).toBe(`docker stop ${containerName}`);
  });

  it("treats already exited container as success when stop fails", async () => {
    const containerName = "docker-cmux-exited-999";
    const tree = makeDockerTree(containerName);

    handlers.handle = (cmd, cb) => {
      if (cmd.startsWith("docker stop ")) {
        cb(new Error("container not running"));
        return;
      }
      if (cmd.startsWith("docker ps -a ")) {
        cb(null, "Exited (0) 2 hours ago\n", "");
        return;
      }
      cb(new Error(`Unexpected command: ${cmd}`));
    };

    const results = await stopContainersForRunsFromTree(tree, "tm_docker_2");
    expect(results).toHaveLength(1);
    expect(results[0]?.success).toBe(true);

    // docker stop + docker ps -a
    expect(execMock).toHaveBeenCalledTimes(2);
  });

  it("returns failure when container does not exist", async () => {
    const containerName = "docker-cmux-missing-000";
    const tree = makeDockerTree(containerName);

    handlers.handle = (cmd, cb) => {
      if (cmd.startsWith("docker stop ")) {
        cb(new Error("No such container"));
        return;
      }
      if (cmd.startsWith("docker ps -a ")) {
        cb(null, "", ""); // nothing found -> not considered exited
        return;
      }
      cb(new Error(`Unexpected command: ${cmd}`));
    };

    const results = await stopContainersForRunsFromTree(tree, "tm_docker_3");
    expect(results).toHaveLength(1);
    expect(results[0]?.success).toBe(false);

    // docker stop + docker ps -a
    expect(execMock).toHaveBeenCalledTimes(2);
  });
});

