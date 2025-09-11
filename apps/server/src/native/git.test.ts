import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getGitImplMode } from "./git.js";

describe("getGitImplMode", () => {
  const prev = { ...process.env };
  beforeEach(() => {
    for (const k of Object.keys(process.env)) {
      if (k === "CMUX_GIT_IMPL") continue;
    }
  });
  afterEach(() => {
    process.env.CMUX_GIT_IMPL = prev.CMUX_GIT_IMPL;
  });

  it("defaults to rust when unset", () => {
    delete process.env.CMUX_GIT_IMPL;
    expect(getGitImplMode()).toBe("rust");
  });

  it("respects js override", () => {
    process.env.CMUX_GIT_IMPL = "js";
    expect(getGitImplMode()).toBe("js");
  });
});

