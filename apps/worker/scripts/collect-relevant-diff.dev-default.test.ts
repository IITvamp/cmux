import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync, execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function run(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, stdio: ["ignore", "pipe", "pipe"] }).toString();
}

describe("collect-relevant-diff.sh with origin default branch 'dev'", () => {
  let dir: string;
  let originDir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cmux-diff-dev-default-"));
    originDir = mkdtempSync(join(tmpdir(), "cmux-origin-bare-dev-"));

    // Init bare origin
    run("git init --bare", originDir);

    // Init working repo and set origin
    run("git init", dir);
    run("git config user.email test@example.com", dir);
    run("git config user.name Test User", dir);
    run(`git remote add origin ${originDir}`, dir);

    // Baseline commit on dev
    const src = join(dir, "src");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "app.ts"), "console.log('hello');\n");
    run("git add -A && git commit -m initial && git branch -M dev", dir);
    run("git push -u origin dev", dir);

    // Set origin default branch to dev and fetch
    run("git symbolic-ref HEAD refs/heads/dev", originDir);
    run("git fetch origin", dir);

    // Create feature branch
    run("git checkout -b feature", dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    rmSync(originDir, { recursive: true, force: true });
  });

  it("diffs against origin/dev default branch", () => {
    const src = join(dir, "src");
    writeFileSync(join(src, "app.ts"), "console.log('hello dev');\n");
    writeFileSync(join(src, "util.ts"), "export const fromDev = true;\n");
    run("git add -A && git commit -m 'feature on dev'", dir);

    const scriptPath = join(process.cwd(), "scripts/collect-relevant-diff.sh");
    const diff = execFileSync("bash", [scriptPath], { cwd: dir }).toString();

    expect(diff).toContain("src/app.ts");
    expect(diff).toContain("src/util.ts");
  });
});

