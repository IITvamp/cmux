#!/usr/bin/env bun
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";

type Result = {
  name: string;
  dir: string;
  success: boolean;
  output: string;
};

function findPackagesWithTests(): { name: string; dir: string }[] {
  const roots = ["apps", "packages"];
  const found: { name: string; dir: string }[] = [];
  for (const root of roots) {
    try {
      const rootPath = join(__dirname, "..", root);
      // Shallow glob: <root>/*/package.json
      const entries: string[] = readdirSync(rootPath);
      for (const entry of entries) {
        const pkgJsonPath = join(rootPath, entry, "package.json");
        if (!existsSync(pkgJsonPath)) continue;
        try {
          const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as {
            name?: string;
            scripts?: Record<string, string>;
          };
          if (pkg.scripts?.test) {
            const dir = dirname(pkgJsonPath);
            found.push({ name: pkg.name ?? `${root}/${entry}`, dir });
          }
        } catch {
          // ignore invalid package.json
        }
      }
    } catch {
      // ignore missing roots
    }
  }
  return found;
}

async function runTests() {
  console.log("🧪 Running Vitest across workspaces in parallel...\n");
  const pkgs = findPackagesWithTests();
  if (pkgs.length === 0) {
    console.log("⚠️  No packages with test scripts found.");
    return;
  }

  const tasks = pkgs.map(({ name, dir }) => {
    return new Promise<Result>((resolve) => {
      let combined = "";
      const child = spawn("pnpm", ["run", "test"], {
        cwd: dir,
        shell: true,
        env: process.env,
      });
      child.stdout?.on("data", (d) => (combined += d.toString()));
      child.stderr?.on("data", (d) => (combined += d.toString()));
      child.on("close", (code) => {
        resolve({ name, dir, success: code === 0, output: combined });
      });
      child.on("error", (err) => {
        resolve({ name, dir, success: false, output: String(err) });
      });
    });
  });

  const results = await Promise.all(tasks);

  console.log("\n📊 Test Results:\n");
  let failures = 0;
  for (const r of results) {
    if (r.success) {
      console.log(`✅ ${r.name}: PASSED`);
    } else {
      failures++;
      console.log(`❌ ${r.name}: FAILED`);
      const lines = r.output.trim().split("\n");
      const last = lines.slice(-200).join("\n");
      console.log(`   Output:\n${last.split("\n").map((l) => `     ${l}`).join("\n")}`);
    }
  }

  if (failures > 0) {
    console.log(`\n❌ ${failures} package(s) failed tests.`);
    process.exit(1);
  } else {
    console.log("\n✅ All package tests passed!");
  }
}

runTests().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
