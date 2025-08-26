import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync, execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function run(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, stdio: ["ignore", "pipe", "pipe"] }).toString();
}

describe("collect-relevant-diff.sh with staged-only changes", () => {
  let dir: string;
  let originDir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cmux-diff-staged-test-"));
    originDir = mkdtempSync(join(tmpdir(), "cmux-origin-bare-"));

    // Init bare origin
    run("git init --bare", originDir);

    // Init working repo and set origin
    run("git init", dir);
    run("git config user.email test@example.com", dir);
    run("git config user.name Test User", dir);
    run(`git remote add origin ${originDir}`, dir);

    // Baseline commit on main
    writeFileSync(join(dir, "README.md"), "hello\n");
    run("git add -A && git commit -m initial && git branch -M main", dir);
    run("git push -u origin main", dir);

    // Set origin default branch
    run("git symbolic-ref HEAD refs/heads/main", originDir);
    run("git fetch origin", dir);

    // Create feature branch
    run("git checkout -b feature", dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    rmSync(originDir, { recursive: true, force: true });
  });

  it("includes staged changes relative to origin base", () => {
    // Stage a change but do not commit
    writeFileSync(join(dir, "README.md"), "hello world\n");
    run("git add README.md", dir);

    const scriptPath = join(process.cwd(), "scripts/collect-relevant-diff.sh");
    const diff = execFileSync("bash", [scriptPath], { cwd: dir }).toString();

    expect(diff).toContain("README.md");
    expect(diff).toContain("hello world");
  });
});

