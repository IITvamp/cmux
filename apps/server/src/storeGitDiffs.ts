import { api } from "@cmux/convex/api";
import type { Id } from "@cmux/convex/dataModel";
import type { ReplaceDiffEntry } from "@cmux/shared";
import { promises as fs } from "node:fs";
import * as path from "path";
import { convex } from "./utils/convexClient";
import { serverLogger } from "./utils/fileLogger";
import { VSCodeInstance } from "./vscode/VSCodeInstance";

/**
 * Parse git diff output and store in Convex gitDiffs table
 */

export async function storeGitDiffs(
  taskRunId: Id<"taskRuns">,
  gitDiff: string,
  vscodeInstance?: VSCodeInstance,
  worktreePath?: string
): Promise<void> {
  try {
    serverLogger.info(
      `[AgentSpawner] Parsing and storing git diffs for taskRun ${taskRunId}`
    );

    // Parse git status section if present
    const statusMatch = gitDiff.match(
      /=== Git Status \(porcelain\) ===\n([\s\S]*?)\n\n/
    );
    const statusLines = statusMatch
      ? statusMatch[1].split("\n").filter((l) => l.trim())
      : [];

    // Parse files from git diff
    const diffSections = gitDiff.split(/^diff --git /m).slice(1);
    serverLogger.info(
      `[AgentSpawner] Found ${diffSections.length} diff sections to parse`
    );

    const toStore: ReplaceDiffEntry[] = [];

    for (const section of diffSections) {
      // Extract file paths - handle spaces in filenames
      const fileMatch = section.match(/^a\/(.*?) b\/(.*)$/m);
      if (!fileMatch) {
        serverLogger.warn(
          `[AgentSpawner] Could not parse file paths from diff section: ${section.substring(0, 100)}`
        );
        continue;
      }

      const oldPath = fileMatch[1];
      const newPath = fileMatch[2];
      const filePath = newPath !== "/dev/null" ? newPath : oldPath;

      // Determine status
      let status: "added" | "modified" | "deleted" | "renamed" = "modified";
      if (section.includes("new file mode")) {
        status = "added";
      } else if (section.includes("deleted file mode")) {
        status = "deleted";
      } else if (section.includes("rename from")) {
        status = "renamed";
      }

      // Count additions and deletions
      const additions = (section.match(/^\+[^+]/gm) || []).length;
      const deletions = (section.match(/^-[^-]/gm) || []).length;

      // Extract the patch content
      const patchMatch = section.match(/^@@[\s\S]*/m);
      const patch = patchMatch ? patchMatch[0] : "";

      // Check if binary
      const isBinary =
        section.includes("Binary files") || section.includes("differ");

      // Try to read file contents if we have worktreePath
      let oldContent: string | undefined;
      let newContent: string | undefined;

      if (worktreePath && !isBinary) {
        const fullPath = path.join(worktreePath, filePath);

        try {
          if (status === "deleted") {
            // For deleted files, we can't read the current content, but we could get it from git
            // For now, just use the patch
            oldContent = undefined;
            newContent = undefined;
          } else if (status === "added") {
            // For added files, there's no old content
            oldContent = "";
            newContent = await fs.readFile(fullPath, "utf-8");
          } else {
            // For modified files, read the current content
            // We'd need to use git show HEAD:filepath to get the old content
            // For now, just get the new content
            newContent = await fs.readFile(fullPath, "utf-8");

            // Try to get old content using git
            try {
              const { exec } = await import("node:child_process");
              const { promisify } = await import("node:util");
              const execAsync = promisify(exec);

              const result = await execAsync(`git show HEAD:"${filePath}"`, {
                cwd: worktreePath,
              });
              oldContent = result.stdout;
            } catch (error) {
              // If git show fails (e.g., file is new), use empty string
              oldContent = "";
              serverLogger.info(
                `[AgentSpawner] Could not get old content for ${filePath}, assuming new file`
              );
            }
          }
        } catch (error) {
          serverLogger.warn(
            `[AgentSpawner] Could not read file ${fullPath}:`,
            error
          );
        }
      }

      // Respect Convex 1 MiB doc limit by omitting large content
      const patchSize =
        !isBinary && patch ? Buffer.byteLength(patch, "utf8") : 0;
      const oldSize = oldContent ? Buffer.byteLength(oldContent, "utf8") : 0;
      const newSize = newContent ? Buffer.byteLength(newContent, "utf8") : 0;
      const totalApprox = patchSize + oldSize + newSize;
      const MAX_DOC_SIZE = 950 * 1024;
      let payload: ReplaceDiffEntry = {
        filePath,
        oldPath: status === "renamed" ? oldPath : undefined,
        status,
        additions,
        deletions,
        isBinary,
        patchSize,
        oldSize,
        newSize,
      };
      if (!isBinary && totalApprox <= MAX_DOC_SIZE) {
        payload.patch = patch;
        payload.oldContent = oldContent;
        payload.newContent = newContent;
        payload.contentOmitted = false;
      } else if (!isBinary) {
        payload.patch = patchSize < MAX_DOC_SIZE ? patch : undefined;
        payload.oldContent = undefined;
        payload.newContent = undefined;
        payload.contentOmitted = true;
      } else {
        payload.contentOmitted = false;
      }

      toStore.push({
        filePath,
        oldPath: status === "renamed" ? oldPath : undefined,
        status,
        additions,
        deletions,
        isBinary,
        patchSize,
        oldSize,
        newSize,
        patch: payload.patch,
        oldContent: payload.oldContent,
        newContent: payload.newContent,
        contentOmitted: payload.contentOmitted,
      });
      serverLogger.info(
        `[AgentSpawner] Prepared diff for ${filePath}: ${status} (+${additions}/-${deletions})`
      );
    }

    // Also handle files from git status that might not be in the diff
    for (const statusLine of statusLines) {
      const [statusCode, ...pathParts] = statusLine.trim().split(/\s+/);
      const filePath = pathParts.join(" ");

      if (!filePath) continue;

      // Map git status codes to our status types
      let status: "added" | "modified" | "deleted" | "renamed" = "modified";
      if (statusCode.includes("A") || statusCode === "??") {
        status = "added";
      } else if (statusCode.includes("D")) {
        status = "deleted";
      } else if (statusCode.includes("R")) {
        status = "renamed";
      }

      // Check if we already stored this file from the diff
      const alreadyStored = diffSections.some((section) =>
        section.includes(filePath)
      );

      if (!alreadyStored) {
        toStore.push({
          filePath,
          status,
          additions: 0,
          deletions: 0,
          isBinary: false,
          contentOmitted: false,
        });
        serverLogger.info(
          `[AgentSpawner] Prepared status-only diff for ${filePath}: ${status}`
        );
      }
    }

    // Bulk replace the diffs in one mutation
    await convex.mutation(api.gitDiffs.replaceForTaskRun, {
      taskRunId,
      diffs: toStore,
    });

    // Update the timestamp
    await convex.mutation(api.gitDiffs.updateDiffsTimestamp, {
      taskRunId,
    });

    serverLogger.info(
      `[AgentSpawner] Successfully stored all diffs for taskRun ${taskRunId}`
    );
  } catch (error) {
    serverLogger.error(`[AgentSpawner] Error storing git diffs:`, error);
  }
}
