import { exec as execCb } from "node:child_process";
import { promises as fs } from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { compareRefsForRepo } from "./compareRefs.js";

const exec = promisify(execCb);

async function initRepo(): Promise<{ repoPath: string; root: string }> {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "cmux-compare-func-"));
  const work = path.join(tmp, "work");
  await fs.mkdir(work, { recursive: true });
  await exec(`git init "${work}"`);
  await exec(`git -C "${work}" config user.name "Test User"`);
  await exec(`git -C "${work}" config user.email "test@example.com"`);
  await exec(`git -C "${work}" checkout -b main`);
  await fs.writeFile(path.join(work, "a.txt"), "a1\n", "utf8");
  await exec(`git -C "${work}" add a.txt`);
  await exec(`git -C "${work}" commit -m init`);
  return { repoPath: work, root: tmp };
}

async function cleanup(dir: string): Promise<void> {
  try {
    await fsp.rm(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

describe("compareRefsForRepo", () => {
  let repoPath: string;
  let root: string;

  beforeEach(async () => {
    const init = await initRepo();
    repoPath = init.repoPath;
    root = init.root;
  });

  afterEach(async () => {
    await cleanup(root);
  });

  it("returns diffs between branches using originPathOverride", async () => {
    // Create changes on a feature branch
    await exec(`git -C "${repoPath}" checkout -b feature`);
    await fs.appendFile(path.join(repoPath, "a.txt"), "a2\n", "utf8");
    await fs.writeFile(path.join(repoPath, "b.txt"), "b\n", "utf8");
    await exec(`git -C "${repoPath}" add .`);
    await exec(`git -C "${repoPath}" commit -m change`);

    const diffs = await compareRefsForRepo({
      ref1: "main",
      ref2: "feature",
      originPathOverride: repoPath,
    });

    const files = new Map(diffs.map((d) => [d.filePath, d]));
    expect(files.has("a.txt")).toBe(true);
    expect(files.get("a.txt")!.status).toBe("modified");
    expect(files.has("b.txt")).toBe(true);
    expect(files.get("b.txt")!.status).toBe("added");
  });
});

