import { describe, it, expect } from "vitest";
import { buildAutoCommitPushCommand } from "./autoCommitPushCommand";

describe("buildAutoCommitPushCommand", () => {
  it("builds a single command with safe JSON quoting", () => {
    const branch = "feat/new-branch";
    const message = "Fix bugs\nAdd features \"quoted\" and $pecial chars";
    const cmd = buildAutoCommitPushCommand({ branchName: branch, commitMessage: message });

    // Builds an &&-chained sequence
    expect(cmd.startsWith("git add -A && ")).toBe(true);

    // Branch names and commit messages are JSON-quoted
    expect(cmd).toContain(`git checkout -b ${JSON.stringify(branch)}`);
    expect(cmd).toContain(`git checkout ${JSON.stringify(branch)}`);
    expect(cmd).toContain(`git commit -m ${JSON.stringify(message)}`);

    // Remote detection and pull --rebase is present
    expect(cmd).toContain(
      `git ls-remote --heads origin ${JSON.stringify(branch)} | grep -q . && git pull --rebase origin ${JSON.stringify(branch)} || echo 'Remote branch missing; skip pull --rebase'`
    );

    // Push with upstream
    expect(cmd).toContain(`git push -u origin ${JSON.stringify(branch)}`);

    // Entire sequence is a single string (no accidental newlines)
    expect(cmd.includes("\n")).toBe(false);
  });

  it("handles odd characters by leaving quoting to JSON", () => {
    const branch = "weird\nbranch name '$(rm -rf /)'";
    const message = `multi-line\nmessage with 'quotes' and \n newlines`;
    const cmd = buildAutoCommitPushCommand({ branchName: branch, commitMessage: message });

    // Ensure the JSON-quoted versions are embedded
    expect(cmd).toContain(JSON.stringify(branch));
    expect(cmd).toContain(JSON.stringify(message));
  });
});
