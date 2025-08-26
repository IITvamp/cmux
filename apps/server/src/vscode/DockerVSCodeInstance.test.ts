import { describe, expect, it } from "vitest";
import { DockerVSCodeInstance } from "./DockerVSCodeInstance.js";
import type { Id } from "@cmux/convex/dataModel";

describe("DockerVSCodeInstance", () => {
  it("should prefix container names with 'docker-'", () => {
    // Create instance with a test taskRunId
    const taskRunId = "test123456789012345678901234" as Id<"taskRuns">;
    const taskId = "task123456789012345678901234" as Id<"tasks">;
    
    const instance = new DockerVSCodeInstance({
      taskRunId,
      taskId,
    });

    // Verify getName() returns the prefixed name
    const name = instance.getName();
    expect(name).toMatch(/^docker-cmux-/);
    // getShortId takes first 12 chars
    expect(name).toBe("docker-cmux-test12345678");
  });

  it("should always return docker- prefixed names for different taskRunIds", () => {
    const testCases = [
      { taskRunId: "abcd1234567890abcdef12345678" as Id<"taskRuns">, expected: "docker-cmux-abcd12345678" },
      { taskRunId: "xyz9876543210xyzabc123456789" as Id<"taskRuns">, expected: "docker-cmux-xyz987654321" },
      { taskRunId: "000000000000111122223333444" as Id<"taskRuns">, expected: "docker-cmux-000000000000" },
    ];

    const taskId = "task123456789012345678901234" as Id<"tasks">;

    for (const { taskRunId, expected } of testCases) {
      const instance = new DockerVSCodeInstance({ taskRunId, taskId });
      expect(instance.getName()).toBe(expected);
    }
  });

  it("ensures docker- prefix distinguishes from other providers", () => {
    // This test verifies the docker- prefix is used as a failsafe to identify Docker instances
    const taskRunId = "jn75ppcyksmh1234567890123456" as Id<"taskRuns">;
    const taskId = "task123456789012345678901234" as Id<"tasks">;
    
    const instance = new DockerVSCodeInstance({
      taskRunId,
      taskId,
    });

    const name = instance.getName();
    
    // Should have docker- prefix
    expect(name.startsWith("docker-")).toBe(true);
    // Should contain the cmux- prefix after docker-
    expect(name).toBe("docker-cmux-jn75ppcyksmh");
    
    // The actual container name (without docker- prefix) should be cmux-jn75ppcyksmh
    // This is what Docker sees as the container name
    const actualDockerContainerName = name.replace("docker-", "");
    expect(actualDockerContainerName).toBe("cmux-jn75ppcyksmh");
  });
});