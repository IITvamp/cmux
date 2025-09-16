import { execFileSync, execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

function run(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, stdio: ["ignore", "pipe", "pipe"] }).toString();
}

describe("collect-relevant-diff.sh in multi-repo workspace", () => {
  let workspaceDir: string;
  let repo1: string;
  let repo2: string;

  beforeEach(() => {
    workspaceDir = mkdtempSync(join(tmpdir(), "cmux-multi-diff-"));

    repo1 = join(workspaceDir, "repo-1");
    repo2 = join(workspaceDir, "repo-2");
    mkdirSync(repo1, { recursive: true });
    mkdirSync(repo2, { recursive: true });

    // Initialize repo-1
    run("git init", repo1);
    run("git config user.email test@example.com", repo1);
    run("git config user.name Test User", repo1);
    writeFileSync(join(repo1, "README.md"), "hello\n");
    run("git add README.md", repo1);
    run("git commit -m initial", repo1);

    // Changes in repo-1: modify tracked file and add new source file
    writeFileSync(join(repo1, "README.md"), "hello world\n");
    mkdirSync(join(repo1, "src"), { recursive: true });
    writeFileSync(join(repo1, "src/app.ts"), "export const message = 'hi';\n");

    // Initialize repo-2
    run("git init", repo2);
    run("git config user.email test@example.com", repo2);
    run("git config user.name Test User", repo2);
    mkdirSync(join(repo2, "lib"), { recursive: true });
    writeFileSync(join(repo2, "lib/index.ts"), "export const value = 0;\n");
    run("git add -A", repo2);
    run("git commit -m initial", repo2);

    // Changes in repo-2: modify tracked file and add new module
    writeFileSync(join(repo2, "lib/index.ts"), "export const value = 1;\n");
    writeFileSync(join(repo2, "lib/new.ts"), "export const added = true;\n");
  });

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true });
  });

  it("collects diffs for each child repository", () => {
    const scriptPath = join(process.cwd(), "scripts/collect-relevant-diff.sh");
    const diff = execFileSync("bash", [scriptPath], { cwd: workspaceDir }).toString();

    const repo1Header = "===== Repository: repo-1 =====";
    const repo2Header = "===== Repository: repo-2 =====";
    const repo1Index = diff.indexOf(repo1Header);
    const repo2Index = diff.indexOf(repo2Header);

    expect(repo1Index).toBeGreaterThanOrEqual(0);
    expect(repo2Index).toBeGreaterThan(repo1Index);

    const repo1Section = diff.slice(repo1Index, repo2Index);
    expect(repo1Section).toContain("diff --git a/README.md b/README.md");
    expect(repo1Section).toContain("src/app.ts");

    const repo2Section = diff.slice(repo2Index);
    expect(repo2Section).toContain("diff --git a/lib/index.ts b/lib/index.ts");
    expect(repo2Section).toContain("lib/new.ts");
  });
});
