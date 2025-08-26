import { execFileSync, execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

function run(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, stdio: ["ignore", "pipe", "pipe"] }).toString();
}

describe("collect-relevant-diff.sh against origin base", () => {
  let dir: string;
  let originDir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cmux-diff-origin-test-"));
    originDir = mkdtempSync(join(tmpdir(), "cmux-origin-bare-"));

    // Init bare origin
    run("git init --bare", originDir);

    // Init working repo
    run("git init", dir);
    run("git config user.email test@example.com", dir);
    run("git config user.name Test User", dir);
    run(`git remote add origin ${originDir}`, dir);

    // Create baseline on main and push
    const src = join(dir, "src");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "app.ts"), "console.log('hello');\n");
    writeFileSync(join(src, "obsolete.ts"), "export const gone = true;\n");
    run("git add -A && git commit -m initial && git branch -M main", dir);
    run("git push -u origin main", dir);

    // Ensure origin default branch is main and fetch to set origin/HEAD
    run("git symbolic-ref HEAD refs/heads/main", originDir);
    run("git fetch origin", dir);

    // Create feature branch
    run("git checkout -b feature", dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    rmSync(originDir, { recursive: true, force: true });
  });

  it("diffs against origin default branch and filters files", () => {
    const src = join(dir, "src");

    // Modify tracked file and add new one, commit changes
    writeFileSync(join(src, "app.ts"), "console.log('hello world');\n");
    writeFileSync(join(src, "util.ts"), "export const x = 1;\n");
    run("git add -A && git commit -m 'feature changes'", dir);

    // Add ignored files
    writeFileSync(join(dir, "pnpm-lock.yaml"), "lock\n");
    writeFileSync(join(dir, "yarn.lock"), "lock\n");
    mkdirSync(join(dir, "node_modules/pkg"), { recursive: true });
    writeFileSync(
      join(dir, "node_modules/pkg/index.js"),
      "module.exports=1;\n"
    );

    // Add a large text file which should be skipped by size
    mkdirSync(join(dir, "docs"), { recursive: true });
    writeFileSync(join(dir, "docs/large.txt"), Buffer.alloc(210_000, 97));

    const scriptPath = join(process.cwd(), "scripts/collect-relevant-diff.sh");
    const diff = execFileSync("bash", [scriptPath], { cwd: dir }).toString();

    // Should include diffs for source files relative to origin/main
    expect(diff).toContain("src/app.ts");
    expect(diff).toContain("src/util.ts");

    // Should NOT include ignored or large files
    expect(diff).not.toContain("pnpm-lock.yaml");
    expect(diff).not.toContain("yarn.lock");
    expect(diff).not.toContain("node_modules");
    expect(diff).not.toContain("docs/large.txt");
  });

  it("includes deletions and file additions (rename may appear as add/delete)", () => {
    // Delete obsolete file and rename app.ts to main.ts (no content change to ensure rename detection)
    run("git rm -f src/obsolete.ts", dir);
    run("git mv src/app.ts src/main.ts", dir);
    // Commit these changes so HEAD has the rename and deletion
    run("git add -A && git commit -m 'rename and delete'", dir);

    const scriptPath = join(process.cwd(), "scripts/collect-relevant-diff.sh");
    const diff = execFileSync("bash", [scriptPath], { cwd: dir }).toString();

    // Deletion should be present
    expect(diff).toMatch(/deleted file mode|^--- a\/.+obsolete\.ts/m);

    // Either a rename is detected or appears as add/delete
    expect(diff).toContain("src/main.ts");
  });
});
