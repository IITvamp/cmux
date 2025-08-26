import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

// Mock Convex client used by the server
vi.mock("./utils/convexClient.js", () => {
  return {
    convex: {
      // Will be customized per-test
      query: vi.fn(),
      mutation: vi.fn(),
    },
  };
});

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

// Avoid waiting for external services on startup
vi.mock("./utils/waitForConvex.js", () => ({
  waitForConvex: vi.fn(async () => {}),
}));

// No-op container state sync during tests
vi.mock("./vscode/DockerVSCodeInstance.js", () => ({
  DockerVSCodeInstance: {
    startContainerStateSync: vi.fn(),
    stopContainerStateSync: vi.fn(),
  },
}));

// No-op GitHub refresh on server start
vi.mock("./utils/refreshGitHubData.js", () => ({
  refreshGitHubData: vi.fn(async () => {}),
  refreshBranchesForRepo: vi.fn(async () => {}),
}));

// Stub child_process.exec that server.ts promisifies to execAsync
// We capture docker commands to assert behavior.
const execCalls: string[] = [];
vi.mock("node:child_process", async () => {
  return {
    exec: (
      command: string,
      optionsOrCb?: any,
      maybeCb?: (error: any, stdout: string, stderr: string) => void
    ) => {
      const cb = typeof optionsOrCb === "function" ? optionsOrCb : maybeCb;
      // Record every command for later assertions
      execCalls.push(command);

      // Short-circuit a few commands used by the server
      if (command.startsWith("ulimit -n")) {
        cb?.(null, "10240\n", "");
        return {} as any;
      }

      if (command.startsWith("docker stop")) {
        // Simulate an error for a specific container to test the fallback path
        if (command.includes("cmux-exited")) {
          const err = new Error("No such container");
          // execAsync would reject; emulate callback error
          cb?.(err as any, "", "Error response from daemon: No such container\n");
        } else {
          cb?.(null, "stopped\n", "");
        }
        return {} as any;
      }

      if (command.startsWith("docker ps -a")) {
        // Return an exited status so the server treats it as already stopped
        cb?.(null, "Exited (0) 2 hours ago\n", "");
        return {} as any;
      }

      // Default noop
      cb?.(null, "", "");
      return {} as any;
    },
    spawn: vi.fn(),
  };
});

// After mocks: import server and socket client
import { startServer } from "./server.js";
import { io as ioc } from "socket.io-client";
import { convex } from "./utils/convexClient.js";

describe.sequential("archive-task stops Docker containers", () => {
  const PORT = 4091;
  let cleanup: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    const srv = await startServer({
      port: PORT,
      publicPath: "/",
      defaultRepo: null,
    });
    cleanup = srv.cleanup;
  }, 20_000);

  afterAll(async () => {
    if (cleanup) await cleanup();
  }, 20_000);

  it("emits archive-task and calls docker stop for each run", async () => {
    // Arrange Convex to return test task runs
    const taskId = "t-1" as any;
    const runs = [
      {
        _id: "run1",
        vscode: { provider: "docker", containerName: "cmux-a" },
      },
      {
        _id: "run2",
        vscode: { provider: "docker", containerName: "cmux-exited" }, // will exercise fallback path
      },
      {
        _id: "run3",
        vscode: { provider: "docker", containerName: "cmux-b" },
      },
    ];

    (convex.query as any).mockImplementation(async (_fn: unknown, args: any) => {
      if (args && args.taskId === taskId) return runs;
      return [];
    });

    // Connect a socket client and emit the event
    const socket = ioc(`http://localhost:${PORT}`, {
      transports: ["websocket"],
      extraHeaders: { Origin: "http://localhost:5173" },
      forceNew: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 50,
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("socket connect timeout")), 5000);
      socket.on("connect", () => {
        clearTimeout(timer);
        resolve();
      });
      socket.on("connect_error", reject);
    });

    const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      socket.emit("archive-task", { taskId }, (res: { success: boolean; error?: string }) => {
        resolve(res);
      });
    });

    socket.close();

    expect(response.success).toBe(true);

    // Assert that docker stop was called for each docker run
    const stopCalls = execCalls.filter((c) => c.startsWith("docker stop"));
    expect(stopCalls).toEqual([
      "docker stop cmux-a",
      "docker stop cmux-exited",
      "docker stop cmux-b",
    ]);

    // Also ensure we checked status for the exited one
    const psChecks = execCalls.filter((c) => c.startsWith("docker ps -a"));
    expect(psChecks.some((c) => c.includes("cmux-exited"))).toBe(true);
  }, 20_000);
});

