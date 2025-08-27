import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync, execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function run(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, stdio: ["ignore", "pipe", "pipe"] }).toString();
}

describe("collect-relevant-diff.sh with CMUX_DIFF_BASE override", () => {
  let dir: string;
  let originDir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cmux-diff-base-override-"));
    originDir = mkdtempSync(join(tmpdir(), "cmux-origin-bare-override-"));

    // Init bare origin
    run("git init --bare", originDir);

    // Init working repo and set origin
    run("git init", dir);
    run("git config user.email test@example.com", dir);
    run("git config user.name Test User", dir);
    run(`git remote add origin ${originDir}`, dir);

    // Baseline commit on main
    writeFileSync(join(dir, "README.md"), "baseline\n");
    run("git add -A && git commit -m initial && git branch -M main", dir);
    run("git push -u origin main", dir);

    // Set origin default to main and fetch
    run("git symbolic-ref HEAD refs/heads/main", originDir);
    run("git fetch origin", dir);

    // Create feature branch and change README
    run("git checkout -b feature", dir);
    writeFileSync(join(dir, "README.md"), "feature-change\n");
    run("git add README.md && git commit -m 'feature change'", dir);

    // Create baseline branch on origin equal to feature commit, so diff vs baseline should be empty
    run("git branch baseline", dir);
    run("git push -u origin baseline", dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    rmSync(originDir, { recursive: true, force: true });
  });

  it("uses CMUX_DIFF_BASE when provided", () => {
    const scriptPath = join(process.cwd(), "scripts/collect-relevant-diff.sh");

    // Without override, origin/HEAD=main base should show a diff
    const diffDefault = execFileSync("bash", [scriptPath], { cwd: dir }).toString();
    expect(diffDefault).toContain("README.md");

    // With override to origin/baseline (which equals HEAD), diff should be empty
    const diffOverride = execFileSync("bash", ["-lc", `CMUX_DIFF_BASE=origin/baseline bash ${scriptPath}`], { cwd: dir }).toString();
    expect(diffOverride).toBe("");
  });
});

