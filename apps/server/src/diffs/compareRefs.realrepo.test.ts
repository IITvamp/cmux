import { describe, it, expect, beforeAll } from "vitest";
import { compareRefsForRepo } from "./compareRefs.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";

describe.sequential("compareRefsForRepo - real repo (cmux PR 259)", () => {
  let tempDir: string;
  
  beforeAll(async () => {
    // Force Rust implementation for this test
    process.env.CMUX_GIT_IMPL = "rust";
    // Create a temporary directory for the test
    tempDir = await mkdtemp(join(tmpdir(), "cmux-test-"));
  });

  it(
    "reads +2/-0 for README.md on PR branch",
    async () => {
      const entries = await compareRefsForRepo({
        ref1: "main",
        ref2: "cmux/update-readme-to-bold-its-last-line-rpics",
        repoFullName: "manaflow-ai/cmux",
        originPathOverride: tempDir, // Use temp dir to bypass auth requirement
        includeContents: true as unknown as never, // not part of CompareRefsArgs
      } as unknown as Parameters<typeof compareRefsForRepo>[0]);

      const readme = entries.find((e) => e.filePath === "README.md");
      expect(readme).toBeTruthy();
      expect(readme!.additions).toBe(2);
      expect(readme!.deletions).toBe(0);
    },
    180_000
  );
});

