import { describe, expect, it } from "vitest";
import { getVSCodeSubdomain } from "./getVSCodeSubdomain.js";

describe("getVSCodeSubdomain", () => {
  it("uses the taskRunId when container name is not provided", () => {
    expect(
      getVSCodeSubdomain({ taskRunId: "abc123def456" })
    ).toBe("abc123def456");
  });

  it("strips docker and cmux prefixes from container names", () => {
    expect(
      getVSCodeSubdomain({
        taskRunId: "ignored",
        containerName: "docker-cmux-foo123",
      })
    ).toBe("foo123");

    expect(
      getVSCodeSubdomain({
        taskRunId: "ignored",
        containerName: "cmux-bar456",
      })
    ).toBe("bar456");
  });

  it("sanitizes unexpected characters and enforces length", () => {
    expect(
      getVSCodeSubdomain({
        taskRunId: "Test_ID",
      })
    ).toBe("test-id");

    const longId = "x".repeat(200);
    expect(
      getVSCodeSubdomain({
        taskRunId: longId,
      }).length
    ).toBeLessThanOrEqual(63);
  });
});
