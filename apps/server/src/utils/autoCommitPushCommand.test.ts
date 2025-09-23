import { describe, expect, it } from "vitest";
import { buildAutoCommitPushCommand } from "./autoCommitPushCommand";

describe("buildAutoCommitPushCommand", () => {
  it("builds a bun script with proper escaping", () => {
    const branch = "feat/new-branch";
    const message = 'Fix bugs\nAdd features "quoted" and $pecial chars';
    const cmd = buildAutoCommitPushCommand({
      branchName: branch,
      commitMessage: message,
    });

    // Verify it's a Bun script
    expect(cmd.startsWith("#!/usr/bin/env bun")).toBe(true);
    expect(cmd).toContain('import { $ } from "bun"');

    // Verify branch name is properly included
    expect(cmd).toContain(`const branchName = '${branch}'`);

    // Verify commit message is properly escaped with newlines converted to \n
    expect(cmd).toContain("const commitMessage = 'Fix bugs\\nAdd features");
    expect(cmd).toContain(".replace(/\\\\n/g, '\\n')");

    // Verify key git operations
    expect(cmd).toContain("git add -A");
    expect(cmd).toContain("await $`git -C ${repoPath} commit -m ${commitMessage}`");
    expect(cmd).toContain("await $`git -C ${repoPath} push -u origin ${branchName}`");

    // Verify error handling
    expect(cmd).toContain("console.error");
    expect(cmd).toContain("process.exit(1)");
  });

  it("handles multi-line commit messages properly", () => {
    const branch = "fix-branch";
    const message = `docs(readme): add haiku on environment variables

This is a multi-line commit message
with 'quotes' and special chars`;
    const cmd = buildAutoCommitPushCommand({
      branchName: branch,
      commitMessage: message,
    });

    // Verify multi-line message is escaped properly
    expect(cmd).toContain("docs(readme): add haiku on environment variables\\n\\nThis is a multi-line commit message\\nwith ");
    expect(cmd).toContain(".replace(/\\\\n/g, '\\n')");

    // Verify the generated script doesn't have unterminated strings
    // Check that newlines are properly escaped
    const lines = cmd.split('\n');
    const commitMessageLine = lines.find(line => line.includes("const commitMessage = '"));
    expect(commitMessageLine).toBeDefined();
    // Should not contain raw newlines in the string literal
    expect(commitMessageLine).not.toMatch(/const commitMessage = '[^']*\n[^']*'/);
  });

  it("handles single quotes in commit messages", () => {
    const branch = "fix-quotes";
    const message = "Fix 'single quotes' and other's apostrophes";
    const cmd = buildAutoCommitPushCommand({
      branchName: branch,
      commitMessage: message,
    });

    // Verify single quotes are escaped properly
    expect(cmd).toContain("Fix '\\''single quotes'\\'' and other'\\''s apostrophes");

    // Verify no raw newlines in string literal
    const lines = cmd.split('\n');
    const commitMessageLine = lines.find(line => line.includes("const commitMessage = '"));
    expect(commitMessageLine).toBeDefined();
    expect(commitMessageLine).not.toMatch(/const commitMessage = '[^']*\n[^']*'/);
    // Verify escaped single quotes are correct
    expect(commitMessageLine).toContain("'\\''single quotes'\\''");
  });
});