import { describe, expect, it } from "vitest";
import { __TEST_ONLY__ } from "./github_setup";

const { normalizeInstallationRepo, getNextLink, parseTimestampMillis } =
  __TEST_ONLY__;

describe("github_setup helpers", () => {
  it("normalizes installation repo payload", () => {
    const payload = {
      id: 42,
      full_name: "cmux/example",
      name: "example",
      owner: { login: "cmux", type: "Organization" },
      private: true,
      default_branch: "main",
      clone_url: "https://github.com/cmux/example.git",
      pushed_at: "2024-01-01T12:34:56Z",
    } satisfies Parameters<typeof normalizeInstallationRepo>[0];

    const result = normalizeInstallationRepo(payload);
    expect(result).toEqual({
      providerRepoId: 42,
      fullName: "cmux/example",
      org: "cmux",
      name: "example",
      gitRemote: "https://github.com/cmux/example.git",
      ownerLogin: "cmux",
      ownerType: "Organization",
      visibility: "private",
      defaultBranch: "main",
      lastPushedAt: Date.parse("2024-01-01T12:34:56Z"),
    });
  });

  it("returns null when required fields are missing", () => {
    expect(normalizeInstallationRepo({ name: "example" })).toBeNull();
    expect(normalizeInstallationRepo({ full_name: "" })).toBeNull();
  });

  it("parses next link from GitHub pagination headers", () => {
    const header =
      '<https://api.github.com/?page=2>; rel="next", <https://api.github.com/?page=3>; rel="last"';
    expect(getNextLink(header)).toBe("https://api.github.com/?page=2");
    expect(getNextLink('<https://api.github.com/?page=1>; rel="prev"')).toBe(
      null
    );
    expect(getNextLink(null)).toBeNull();
  });

  it("parses timestamps when valid", () => {
    expect(parseTimestampMillis("2024-01-01T00:00:00Z")).toBe(
      Date.parse("2024-01-01T00:00:00Z")
    );
    expect(parseTimestampMillis("not-a-date")).toBeUndefined();
    expect(parseTimestampMillis(null)).toBeUndefined();
  });
});
