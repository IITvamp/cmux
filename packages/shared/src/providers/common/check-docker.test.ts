import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureDockerBinaryInPath } from "./check-docker";

const DOCKER_BINARY_NAME = process.platform === "win32" ? "docker.exe" : "docker";
const PATH_DELIMITER = process.platform === "win32" ? ";" : ":";

describe("ensureDockerBinaryInPath", () => {
  let originalPath: string | undefined;
  let originalExtraPaths: string | undefined;

  beforeEach(() => {
    originalPath = process.env.PATH;
    originalExtraPaths = process.env.DOCKER_EXTRA_PATHS;
  });

  afterEach(() => {
    if (originalPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = originalPath;
    }

    if (originalExtraPaths === undefined) {
      delete process.env.DOCKER_EXTRA_PATHS;
    } else {
      process.env.DOCKER_EXTRA_PATHS = originalExtraPaths;
    }
  });

  it("adds docker binary directories from DOCKER_EXTRA_PATHS to PATH", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "cmux-docker-path-"));
    const binaryPath = join(tempDir, DOCKER_BINARY_NAME);
    writeFileSync(binaryPath, "#!/bin/sh\nexit 0\n");
    chmodSync(binaryPath, 0o755);

    try {
      process.env.PATH = "/bin";
      process.env.DOCKER_EXTRA_PATHS = tempDir;

      ensureDockerBinaryInPath();

      const updatedPath = process.env.PATH ?? "";
      expect(updatedPath.startsWith(`${tempDir}${PATH_DELIMITER}`)).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("does not duplicate entries when invoked multiple times", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "cmux-docker-path-"));
    const binaryPath = join(tempDir, DOCKER_BINARY_NAME);
    writeFileSync(binaryPath, "#!/bin/sh\nexit 0\n");
    chmodSync(binaryPath, 0o755);

    try {
      process.env.PATH = "/bin";
      process.env.DOCKER_EXTRA_PATHS = tempDir;

      ensureDockerBinaryInPath();
      ensureDockerBinaryInPath();

      const entries = (process.env.PATH ?? "").split(PATH_DELIMITER);
      const matches = entries.filter((entry) => entry === tempDir).length;
      expect(matches).toBe(1);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
