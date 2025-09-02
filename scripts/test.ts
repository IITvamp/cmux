#!/usr/bin/env bun
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";

type Result = {
  name: string;
  dir: string;
  success: boolean;
  output: string;
  durationMs: number;
  usedJsonReporter: boolean;
};

type PkgWithTest = {
  name: string;
  dir: string;
  testScript: string;
  isVitest: boolean;
  usesDotenv: boolean;
  dotenvEnvPath?: string;
};

function findPackagesWithTests(): PkgWithTest[] {
  const roots = ["apps", "packages"];
  const found: PkgWithTest[] = [];
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
          const testScript = pkg.scripts?.test;
          if (testScript) {
            const dir = dirname(pkgJsonPath);
            const isVitest = /\bvitest\b/.test(testScript);
            const usesDotenv = /\bdotenv\b/.test(testScript);
            let dotenvEnvPath: string | undefined;
            if (usesDotenv) {
              // naive token parse to find: -e <path>
              const tokens = testScript.split(/\s+/);
              for (let i = 0; i < tokens.length - 1; i++) {
                if (tokens[i] === "-e") {
                  dotenvEnvPath = tokens[i + 1];
                  break;
                }
              }
            }
            found.push({
              name: pkg.name ?? `${root}/${entry}`,
              dir,
              testScript,
              isVitest,
              usesDotenv,
              dotenvEnvPath,
            });
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

type TestStatus = "passed" | "failed" | "skipped" | "todo" | "only" | "unknown";
type PerTestTiming = {
  packageName: string;
  filePath: string;
  title: string;
  fullName: string;
  durationMs: number;
  status: TestStatus;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

// Attempts to extract per-test timings from Vitest JSON reporter output.
function parseVitestPerTests(output: string, pkgName: string): PerTestTiming[] {
  const trimmed = output.trim();
  let obj: unknown;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    // Best-effort: try to find the last JSON object in the output
    const lastOpen = trimmed.lastIndexOf("{");
    if (lastOpen !== -1) {
      const candidate = trimmed.slice(lastOpen);
      try {
        obj = JSON.parse(candidate);
      } catch {
        return [];
      }
    } else {
      return [];
    }
  }

  const perTests: PerTestTiming[] = [];

  // Shape 1: Jest-like JSON with testResults -> assertionResults
  if (
    isRecord(obj) &&
    Array.isArray((obj as Record<string, unknown>)["testResults"])
  ) {
    const arr = (obj as Record<string, unknown>)["testResults"] as unknown[];
    for (const fileRes of arr) {
      if (!isRecord(fileRes)) continue;
      const filePath =
        asString(fileRes["name"]) || asString(fileRes["file"]) || "";
      const assertions = fileRes["assertionResults"];
      if (Array.isArray(assertions)) {
        for (const a of assertions) {
          if (!isRecord(a)) continue;
          const title =
            asString(a["title"]) ||
            asString(a["name"]) ||
            asString(a["fullName"]) ||
            "";
          const fullName = asString(a["fullName"]) || title;
          const duration = asNumber(a["duration"]) ?? 0;
          const statusRaw =
            asString(a["status"]) || asString(a["state"]) || "unknown";
          const status: TestStatus =
            statusRaw === "passed" ||
            statusRaw === "failed" ||
            statusRaw === "skipped" ||
            statusRaw === "todo" ||
            statusRaw === "only"
              ? statusRaw
              : "unknown";
          if (title && duration >= 0) {
            perTests.push({
              packageName: pkgName,
              filePath,
              title,
              fullName,
              durationMs: duration,
              status,
            });
          }
        }
      }
    }
  }

  // Shape 2: Vitest-style flattened tests array with name/title + duration
  if (
    perTests.length === 0 &&
    isRecord(obj) &&
    Array.isArray((obj as Record<string, unknown>)["tests"])
  ) {
    const tests = (obj as Record<string, unknown>)["tests"] as unknown[];
    for (const t of tests) {
      if (!isRecord(t)) continue;
      const title = asString(t["title"]) || asString(t["name"]) || "";
      const fullName = asString(t["fullName"]) || title;
      const duration = asNumber(t["duration"]) ?? 0;
      const filePath = asString(t["file"]) || asString(t["filepath"]) || "";
      const statusRaw =
        asString(t["status"]) || asString(t["state"]) || "unknown";
      const status: TestStatus =
        statusRaw === "passed" ||
        statusRaw === "failed" ||
        statusRaw === "skipped" ||
        statusRaw === "todo" ||
        statusRaw === "only"
          ? statusRaw
          : "unknown";
      if (title && duration >= 0) {
        perTests.push({
          packageName: pkgName,
          filePath,
          title,
          fullName,
          durationMs: duration,
          status,
        });
      }
    }
  }

  return perTests;
}

async function runTests() {
  const showTimings = process.argv.includes("--timings");
  console.log(
    `🧪 Running tests across workspaces in parallel${showTimings ? " (with per-test timings)" : ""}...\n`
  );
  const pkgs = findPackagesWithTests();
  if (pkgs.length === 0) {
    console.log("⚠️  No packages with test scripts found.");
    return;
  }
  // Log which workspaces will run tests
  const workspaceNames = pkgs.map((p) => p.name).join(", ");
  console.log(`🧵 Workspaces to test (${pkgs.length}): ${workspaceNames}`);

  const allPerTests: PerTestTiming[] = [];

  const tasks = pkgs.map(
    ({ name, dir, isVitest, usesDotenv, dotenvEnvPath }) => {
      return new Promise<Result>((resolve) => {
        let combined = "";
        const start = performance.now();
        const cmd = "pnpm";
        let args: string[];
        const useJson = showTimings && isVitest;
        if (useJson) {
          // Prefer pnpm exec to avoid the extra `--` being forwarded to vitest
          if (usesDotenv) {
            // Replicate `dotenv -e <path> -- vitest run` with JSON reporter
            args = [
              "exec",
              "dotenv",
              ...(dotenvEnvPath ? ["-e", dotenvEnvPath] : []),
              "--",
              "vitest",
              "run",
              "--reporter=json",
              "--silent",
            ];
          } else {
            args = ["exec", "vitest", "run", "--reporter=json", "--silent"];
          }
        } else {
          // Normal run (no JSON reporter), preserves raw console logs
          args = ["run", "test"];
        }
        // Log when each workspace starts running
        console.log(`▶️  ${name}: starting tests`);
        const child = spawn(cmd, args, {
          cwd: dir,
          shell: true,
          env: process.env,
        });
        child.stdout?.on("data", (d) => (combined += d.toString()));
        child.stderr?.on("data", (d) => (combined += d.toString()));
        child.on("close", (code) => {
          const durationMs = performance.now() - start;
          if (useJson) {
            try {
              const per = parseVitestPerTests(combined, name);
              allPerTests.push(...per);
            } catch {
              // ignore parse errors; fall back to package-level timing only
            }
          }
          console.log(
            `${code === 0 ? "✅" : "❌"} ${name}: finished in ${(durationMs / 1000).toFixed(2)}s`
          );
          resolve({
            name,
            dir,
            success: code === 0,
            output: combined,
            durationMs,
            usedJsonReporter: useJson,
          });
        });
        child.on("error", (err) => {
          const durationMs = performance.now() - start;
          console.log(`❌ ${name}: errored after ${(durationMs / 1000).toFixed(2)}s`);
          resolve({
            name,
            dir,
            success: false,
            output: String(err),
            durationMs,
            usedJsonReporter: useJson,
          });
        });
      });
    }
  );

  const results = await Promise.all(tasks);

  // Sort by duration ascending so the longest running are at the bottom
  results.sort((a, b) => a.durationMs - b.durationMs);

  console.log("\n📊 Test Results (sorted by duration, slowest last):\n");
  let failures = 0;
  for (const r of results) {
    if (r.success) {
      const secs = (r.durationMs / 1000).toFixed(2);
      console.log(`✅ ${r.name}: PASSED in ${secs}s`);
    } else {
      failures++;
      const secs = (r.durationMs / 1000).toFixed(2);
      console.log(`❌ ${r.name}: FAILED in ${secs}s`);
      if (r.usedJsonReporter) {
        // If we ran vitest with --silent for JSON, re-run to print raw logs.
        try {
          const retry = await new Promise<string>((resolve) => {
            const child = spawn("pnpm", ["run", "test"], {
              cwd: r.dir,
              shell: true,
              env: process.env,
            });
            let buf = "";
            child.stdout?.on("data", (d) => (buf += d.toString()));
            child.stderr?.on("data", (d) => (buf += d.toString()));
            child.on("close", () => resolve(buf));
            child.on("error", () => resolve(buf));
          });
          const lines = retry.trim().split("\n");
          const last = lines.slice(-200).join("\n");
          console.log(
            `   Output (tail):\n${last
              .split("\n")
              .map((l) => `     ${l}`)
              .join("\n")}`
          );
        } catch {
          const lines = r.output.trim().split("\n");
          const last = lines.slice(-200).join("\n");
          console.log(
            `   Output (tail):\n${last
              .split("\n")
              .map((l) => `     ${l}`)
              .join("\n")}`
          );
        }
      } else {
        // Already have raw logs in r.output
        const lines = r.output.trim().split("\n");
        const last = lines.slice(-200).join("\n");
        console.log(
          `   Output (tail):\n${last
            .split("\n")
            .map((l) => `     ${l}`)
            .join("\n")}`
        );
      }
    }
  }

  // Per-test timing summary (only for Vitest packages where JSON output could be parsed)
  if (showTimings && allPerTests.length > 0) {
    allPerTests.sort((a, b) => a.durationMs - b.durationMs);
    console.log("\n⏱️  Per-test timings (Vitest) — slowest last:\n");
    for (const t of allPerTests) {
      const secs = (t.durationMs / 1000).toFixed(3);
      // Keep line concise: package, file (basename), test title, time, status
      const fileName = t.filePath ? t.filePath.split("/").slice(-1)[0] : "";
      console.log(
        ` • ${t.packageName}${fileName ? `/${fileName}` : ""} :: ${t.title} — ${secs}s ${t.status}`
      );
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
