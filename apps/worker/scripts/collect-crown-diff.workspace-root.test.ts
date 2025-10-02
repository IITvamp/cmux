import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync, execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function run(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, stdio: ["ignore", "pipe", "pipe"] }).toString();
}

describe("collect-crown-diff.sh workspace discovery", () => {
  let workspaceDir: string;
  let alphaRepo: string;
  let betaRepo: string;

  beforeEach(() => {
    workspaceDir = mkdtempSync(join(tmpdir(), "cmux-crown-workspace-"));
    alphaRepo = join(workspaceDir, "alpha-repo");
    betaRepo = join(workspaceDir, "beta-repo");

    mkdirSync(alphaRepo, { recursive: true });
    mkdirSync(betaRepo, { recursive: true });

    run("git init", alphaRepo);
    run("git config user.email test@example.com", alphaRepo);
    run("git config user.name Test User", alphaRepo);
    writeFileSync(join(alphaRepo, "app.ts"), "console.log('base');\n");
    run("git add app.ts", alphaRepo);
    run("git commit -m base", alphaRepo);

    writeFileSync(join(alphaRepo, "app.ts"), "console.log('alpha change');\n");

    run("git init", betaRepo);
    run("git config user.email test@example.com", betaRepo);
    run("git config user.name Test User", betaRepo);
    writeFileSync(join(betaRepo, "README.md"), "beta base\n");
    run("git add README.md", betaRepo);
    run("git commit -m base", betaRepo);
  });

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true });
  });

  it("collects diff from the first nested repository", () => {
    const scriptPath = join(process.cwd(), "scripts/collect-crown-diff.sh");
    const diff = execFileSync("bash", [scriptPath], { cwd: workspaceDir }).toString();

    expect(diff).toContain("app.ts");
    expect(diff).toContain("alpha change");
    expect(diff).not.toContain("beta base");
  });
});
