import { exec } from "node:child_process";
import { RepositoryManager } from "./repositoryManager.js";
import chokidar, { type FSWatcher } from "chokidar";
import { promises as fsp } from "node:fs";
import * as path from "node:path";
import ignore from "ignore";
import { promisify } from "node:util";
import { serverLogger } from "./utils/fileLogger.js";

const execAsync = promisify(exec);

export class GitDiffManager {
  private watchers: Map<string, FSWatcher> = new Map();

  async getFullDiff(workspacePath: string): Promise<string> {
    try {
      // Determine a sensible base ref for diffing:
      // 1) Use the current branch's upstream if configured
      // 2) Otherwise, use the repository's default branch (origin/<default>)
      // 3) Fallback to origin/main as last resort

      let baseRef = "origin/main";
      try {
        const upstream = await execAsync(
          "git rev-parse --abbrev-ref --symbolic-full-name @{u}",
          { cwd: workspacePath }
        );
        const u = upstream.stdout.trim();
        if (u) baseRef = "@{upstream}"; // Let git resolve symbolic upstream
      } catch {
        try {
          const repoMgr = RepositoryManager.getInstance();
          const defaultBranch = await repoMgr.getDefaultBranch(workspacePath);
          baseRef = `origin/${defaultBranch}`;
        } catch {
          // keep fallback origin/main
        }
      }

      // Run git diff with color to get all changes
      const { stdout, stderr } = await execAsync(
        `git diff --color=always ${baseRef}`,
        {
          cwd: workspacePath,
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large diffs
          env: {
            ...process.env,
            FORCE_COLOR: "1",
            GIT_PAGER: "cat", // Disable pager
          },
        }
      );

      if (stderr) {
        serverLogger.error("Git diff stderr:", stderr);
      }

      return stdout || "";
    } catch (error) {
      serverLogger.error("Error getting git diff:", error);
      throw new Error("Failed to get git diff");
    }
  }

  async watchWorkspace(
    workspacePath: string,
    onChange: (changedPath: string) => void
  ): Promise<void> {
    if (this.watchers.has(workspacePath)) {
      return;
    }

    try {
      // Build ignore matcher from .gitignore + defaults
      const ig = ignore();
      try {
        const giPath = path.join(workspacePath, ".gitignore");
        const contents = await fsp.readFile(giPath, "utf8");
        ig.add(contents.split("\n"));
      } catch {
        // no .gitignore; proceed with defaults
      }
      // Always ignore VCS internals and common heavy dirs
      ig.add([
        ".git/",
        "node_modules/",
        "dist/",
        "build/",
        ".next/",
        "out/",
        ".cache/",
        ".turbo/",
        ".parcel-cache/",
        ".idea/",
        ".vscode/",
        "**/*.log",
      ]);

      const ignoredFn = (p: string): boolean => {
        // chokidar provides absolute paths; convert to repo-relative
        const rel = path.relative(workspacePath, p);
        // Skip anything outside the workspace
        if (rel.startsWith("..")) return true;
        // Root of workspace returns ""; never test "." against ignore
        if (rel === "") return false;
        const relPath = rel.replace(/\\/g, "/");
        return ig.ignores(relPath);
      };

      const watcher = chokidar.watch(workspacePath, {
        ignored: ignoredFn,
        persistent: true,
        ignoreInitial: true,
        depth: 8,
        usePolling: false,
        awaitWriteFinish: {
          stabilityThreshold: 400,
          pollInterval: 100,
        },
        followSymlinks: false,
        atomic: false,
      });

      // Add error handling for the watcher
      watcher.on("error", (error) => {
        serverLogger.error("File watcher error:", error);
        // Don't crash, just log the error
      });

      watcher.on("ready", () => {
        serverLogger.info(`File watcher ready for ${workspacePath}`);
      });

      watcher.on("change", (filePath) => {
        onChange(filePath);
      });

      watcher.on("add", (filePath) => {
        onChange(filePath);
      });

      watcher.on("unlink", (filePath) => {
        onChange(filePath);
      });

      this.watchers.set(workspacePath, watcher);
    } catch (error) {
      serverLogger.error("Failed to create file watcher:", error);
      // Don't throw - just log and continue without watching
    }
  }

  unwatchWorkspace(workspacePath: string): void {
    const watcher = this.watchers.get(workspacePath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(workspacePath);
    }
  }

  dispose(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
  }
}
