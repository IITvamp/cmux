#!/usr/bin/env bun
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Dirent } from "node:fs";
import semver from "semver";

type DependencyMap = Record<string, string>;

interface PackageJson {
  dependencies?: DependencyMap;
  devDependencies?: DependencyMap;
  optionalDependencies?: DependencyMap;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const packageJsonPath = resolve(projectRoot, "package.json");

const packageJsonRaw = readFileSync(packageJsonPath, "utf8");
const packageJson = JSON.parse(packageJsonRaw) as PackageJson;

const pickDependencyVersion = (map: DependencyMap | undefined): string | undefined => {
  if (!map) return undefined;
  return map.electron;
};

const versionRange =
  pickDependencyVersion(packageJson.devDependencies) ??
  pickDependencyVersion(packageJson.dependencies) ??
  pickDependencyVersion(packageJson.optionalDependencies);

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

if (process.platform === "darwin") {
  try {
    const result = spawnSync("clang", ["-v"], { encoding: "utf8" });
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    if (/You have not agreed to the Xcode license/i.test(output)) {
      console.warn(
        "Skipping electron-rebuild: Xcode license not accepted; N-API prebuilds suffice.",
      );
      process.exit(0);
    }
  } catch {
    console.warn("Skipping electron-rebuild: clang not available; using prebuilds.");
    process.exit(0);
  }
}

const workspaceRoot = resolve(projectRoot, "..");
const moduleDirs = [resolve(projectRoot, "node_modules"), resolve(workspaceRoot, "node_modules")];
const nodeModulesDir = moduleDirs.find((dir) => existsSync(dir));

if (nodeModulesDir) {
  const napiOnly = new Set(["bufferutil", "utf-8-validate"]);
  const napiPresent: string[] = [];
  let hasOtherNative = false;

  const checkPkg = (name: string, dir: string) => {
    const bindingGypPath = resolve(dir, "binding.gyp");
    if (existsSync(bindingGypPath)) {
      if (napiOnly.has(name)) {
        napiPresent.push(name);
      } else {
        hasOtherNative = true;
      }
    }
  };

  const scanDir = (dir: string, scope?: string) => {
    const entries = readdirSync(dir, { withFileTypes: true });
    entries.forEach((entry: Dirent) => {
      if (!entry.isDirectory()) return;
      if (entry.name.startsWith(".")) return;

      const fullPath = resolve(dir, entry.name);
      if (scope) {
        checkPkg(`${scope}/${entry.name}`, fullPath);
      } else if (entry.name.startsWith("@")) {
        scanDir(fullPath, entry.name);
      } else {
        checkPkg(entry.name, fullPath);
      }
    });
  };

  scanDir(nodeModulesDir);

  if (napiPresent.length > 0 && !hasOtherNative) {
    console.log(
      `Skipping electron-rebuild: only N-API modules detected (${napiPresent.join(", ")}).`,
    );
    process.exit(0);
  }
}

const bunxBinary = process.platform === "win32" ? "bunx.cmd" : "bunx";

interface RunResult {
  stdout: string;
  stderr: string;
}

interface RunError extends RunResult {
  code?: number;
  signal?: NodeJS.Signals;
  error?: Error;
}

const runRebuild = (useElectronClang: boolean): Promise<RunResult> =>
  new Promise((resolve, reject) => {
    const args = ["@electron/rebuild", "-f", "-t", "prod,dev"];
    if (useElectronClang) args.push("--use-electron-clang");
    args.push("--version", version);

    const child = spawn(bunxBinary, args, {
      cwd: projectRoot,
      env: process.env,
      stdio: ["inherit", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(chunk);
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });

    child.on("error", (error) => {
      const failure: RunError = { error, stdout, stderr, code: 1 };
      reject(failure);
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        const failure: RunError = { code: 1, signal, stdout, stderr };
        reject(failure);
      } else if (code && code !== 0) {
        const failure: RunError = { code, stdout, stderr };
        reject(failure);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });

const main = async (): Promise<void> => {
  try {
    await runRebuild(false);
    process.exit(0);
  } catch (error) {
    const failure = error as RunError;
    if (failure.stderr) {
      process.stderr.write(failure.stderr);
    }
    if (failure.error) {
      console.error("Failed to launch electron-rebuild:", failure.error);
    }
    process.exit(failure.code ?? 1);
  }
};

void main();
