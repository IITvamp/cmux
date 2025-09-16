#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import semver from "semver";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const packageJsonPath = resolve(projectRoot, "package.json");

const packageJsonRaw = readFileSync(packageJsonPath, "utf8");
const packageJson = JSON.parse(packageJsonRaw);

const versionRange =
  packageJson.devDependencies?.electron ??
  packageJson.dependencies?.electron ??
  packageJson.optionalDependencies?.electron;

if (!versionRange) {
  console.error("electron dependency is not declared in package.json");
  process.exit(1);
}

const version =
  semver.valid(versionRange) ?? semver.coerce(versionRange)?.version ?? undefined;

if (!version) {
  console.error(`Unable to determine Electron version from range: ${versionRange}`);
  process.exit(1);
}

const bunxBinary = process.platform === "win32" ? "bunx.cmd" : "bunx";
const child = spawn(
  bunxBinary,
  ["@electron/rebuild", "-f", "-t", "prod,dev", "--version", version],
  {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(1);
  }

  if (code && code !== 0) {
    process.exit(code);
  }

  process.exit(0);
});

child.on("error", (error) => {
  console.error("Failed to launch electron-rebuild:", error);
  process.exit(1);
});
