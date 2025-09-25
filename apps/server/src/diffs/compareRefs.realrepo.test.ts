import { beforeAll, describe, expect, it } from "vitest";
import { compareRefsForRepo } from "./compareRefs";

describe.sequential.skip("compareRefsForRepo - real repo (cmux PR 259)", () => {
  beforeAll(() => {
    // Force Rust implementation for this test
    process.env.CMUX_GIT_IMPL = "rust";
  });

  it("reads +2/-0 for README.md on PR branch", async () => {
    // Skip this test in CI because it requires Convex auth
    // TODO: Create a proper test setup for public repo testing
    const entries = await compareRefsForRepo({
      ref1: "main",
      ref2: "cmux/update-readme-to-bold-its-last-line-rpics",
      repoFullName: "manaflow-ai/cmux",
      teamSlugOrId: "test-team",
      includeContents: true as unknown as never, // not part of CompareRefsArgs
    } as unknown as Parameters<typeof compareRefsForRepo>[0]);

    const readme = entries.find((e) => e.filePath === "README.md");
    expect(readme).toBeTruthy();
    expect(readme!.additions).toBe(2);
    expect(readme!.deletions).toBe(0);
  }, 180_000);
});
