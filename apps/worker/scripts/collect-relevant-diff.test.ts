import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync, execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function run(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, stdio: ["ignore", "pipe", "pipe"] }).toString();
}

describe("collect-relevant-diff.sh", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cmux-diff-test-"));
    run("git init", dir);
    // Configure git user for committing in tests
    run("git config user.email test@example.com", dir);
    run("git config user.name Test User", dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("ignores lockfiles, vendor, images, and includes source changes", () => {
    // baseline tracked file
    const src = join(dir, "src");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "app.ts"), "console.log('hello');\n");
    run("git add -A && git commit -m initial", dir);

    // change tracked file
    writeFileSync(join(src, "app.ts"), "console.log('hello world');\n");

    // add untracked source file
    writeFileSync(join(src, "util.ts"), "export const x = 1;\n");

    // lockfiles and vendors
    writeFileSync(join(dir, "pnpm-lock.yaml"), "lock\n");
    writeFileSync(join(dir, "yarn.lock"), "lock\n");
    writeFileSync(join(dir, "package-lock.json"), "{}\n");
    writeFileSync(join(dir, "bun.lock"), "{}\n");
    writeFileSync(join(dir, "bun.lockb"), new Uint8Array([1, 2, 3]));
    mkdirSync(join(dir, "node_modules/pkg"), { recursive: true });
    writeFileSync(join(dir, "node_modules/pkg/index.js"), "module.exports=1;\n");

    // python
    mkdirSync(join(dir, "venv/lib"), { recursive: true });
    writeFileSync(join(dir, "Pipfile.lock"), "{}\n");
    writeFileSync(join(dir, "uv.lock"), "{}\n");

    // rust
    mkdirSync(join(dir, "target/release"), { recursive: true });
    writeFileSync(join(dir, "Cargo.lock"), "# lock\n");

    // images/binaries
    mkdirSync(join(dir, "images"), { recursive: true });
    writeFileSync(join(dir, "images/test.png"), Buffer.alloc(300000, 1));

    // build artifacts
    mkdirSync(join(dir, "dist"), { recursive: true });
    writeFileSync(join(dir, "dist/bundle.js"), "// built\n");

    // run script
    const scriptPath = join(process.cwd(), "scripts/collect-relevant-diff.sh");
    const diff = execFileSync("bash", [scriptPath], { cwd: dir }).toString();

    // Should include diffs for source files
    expect(diff).toContain("src/app.ts");
    expect(diff).toContain("src/util.ts");

    // Should NOT include ignored files
    expect(diff).not.toContain("pnpm-lock.yaml");
    expect(diff).not.toContain("yarn.lock");
    expect(diff).not.toContain("package-lock.json");
    expect(diff).not.toContain("bun.lock");
    expect(diff).not.toContain("bun.lockb");
    expect(diff).not.toContain("node_modules");
    expect(diff).not.toContain("Pipfile.lock");
    expect(diff).not.toContain("uv.lock");
    expect(diff).not.toContain("Cargo.lock");
    expect(diff).not.toContain("target/");
    expect(diff).not.toContain("dist/");
    expect(diff).not.toContain("images/test.png");
  });
});
