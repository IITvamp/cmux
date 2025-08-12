import { api } from "@cmux/convex/api";
import type { Id } from "@cmux/convex/dataModel";
import { exec } from "node:child_process";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";
import { convex } from "./utils/convexClient.js";
import { serverLogger } from "./utils/fileLogger.js";

const execAsync = promisify(exec);

/**
 * Refresh diffs for a task run by directly reading from the filesystem
 */
export async function refreshDiffsForTaskRun(taskRunId: string): Promise<{ success: boolean; message: string }> {
  try {
    serverLogger.info(`[RefreshDiffs] Starting diff refresh for taskRun ${taskRunId}`);
    
    // Get the task run from Convex
    const taskRun = await convex.query(api.taskRuns.get, {
      id: taskRunId as Id<"taskRuns">
    });
    
    if (!taskRun) {
      return { success: false, message: "Task run not found" };
    }
    
    if (!taskRun.worktreePath) {
      return { success: false, message: "No worktree path for this task run" };
    }
    
    const worktreePath = taskRun.worktreePath;
    serverLogger.info(`[RefreshDiffs] Using worktree: ${worktreePath}`);
    
    // Check if the worktree exists
    try {
      await fs.access(worktreePath);
    } catch {
      return { success: false, message: `Worktree path does not exist: ${worktreePath}` };
    }
    
    // First, stage all changes to capture everything
    try {
      await execAsync("git add -A", { cwd: worktreePath });
      serverLogger.info(`[RefreshDiffs] Staged all changes`);
    } catch (error) {
      serverLogger.warn(`[RefreshDiffs] Failed to stage changes: ${error}`);
    }
    
    // Get the diff of staged changes
    let gitDiff = "";
    try {
      const { stdout: stagedDiff } = await execAsync("git diff --cached", { 
        cwd: worktreePath,
        maxBuffer: 10 * 1024 * 1024 // 10MB
      });
      gitDiff = stagedDiff;
      serverLogger.info(`[RefreshDiffs] Got staged diff: ${gitDiff.length} chars`);
    } catch (error) {
      serverLogger.warn(`[RefreshDiffs] Failed to get staged diff: ${error}`);
    }
    
    // If no staged diff, try diff against HEAD
    if (!gitDiff) {
      try {
        const { stdout: headDiff } = await execAsync("git diff HEAD", { 
          cwd: worktreePath,
          maxBuffer: 10 * 1024 * 1024 
        });
        gitDiff = headDiff;
        serverLogger.info(`[RefreshDiffs] Got HEAD diff: ${gitDiff.length} chars`);
      } catch (error) {
        serverLogger.warn(`[RefreshDiffs] Failed to get HEAD diff: ${error}`);
      }
    }
    
    // Get git status to include untracked files
    let gitStatus = "";
    try {
      const { stdout: status } = await execAsync("git status --porcelain", { cwd: worktreePath });
      gitStatus = status;
      serverLogger.info(`[RefreshDiffs] Git status: ${status.split('\n').filter(Boolean).length} files`);
    } catch (error) {
      serverLogger.warn(`[RefreshDiffs] Failed to get git status: ${error}`);
    }
    
    // Parse and store the diffs
    if (gitDiff || gitStatus) {
      const fullDiff = `=== Git Status (porcelain) ===\n${gitStatus}\n\n${gitDiff}`;
      
      // Parse the diff sections
      const diffSections = gitDiff.split(/^diff --git /m).slice(1);
      serverLogger.info(`[RefreshDiffs] Found ${diffSections.length} diff sections`);
      
      // Prepare diffs to store in bulk to avoid incremental updates
      const toStore: any[] = [];

      // Process each diff section
      for (const section of diffSections) {
        const fileMatch = section.match(/^a\/(.*?) b\/(.*)$/m);
        if (!fileMatch) continue;
        
        const oldPath = fileMatch[1];
        const newPath = fileMatch[2];
        const filePath = newPath !== '/dev/null' ? newPath : oldPath;
        
        // Determine status
        let status: "added" | "modified" | "deleted" | "renamed" = "modified";
        if (section.includes('new file mode')) {
          status = "added";
        } else if (section.includes('deleted file mode')) {
          status = "deleted";
        } else if (section.includes('rename from')) {
          status = "renamed";
        }
        
        // Count additions and deletions
        const additions = (section.match(/^\+[^+]/gm) || []).length;
        const deletions = (section.match(/^-[^-]/gm) || []).length;
        
        // Extract patch
        const patchMatch = section.match(/^@@[\s\S]*/m);
        const patch = patchMatch ? patchMatch[0] : '';
        
        // Check if binary
        const isBinary = section.includes('Binary files') || section.includes('differ');
        
        // Get file contents
        let oldContent = "";
        let newContent = "";
        
        if (!isBinary) {
          const fullPath = path.join(worktreePath, filePath);
          
          try {
            if (status === "deleted") {
              // For deleted files, we can't read the current content
              oldContent = "";
              newContent = "";
            } else if (status === "added") {
              // For added files, there's no old content
              oldContent = "";
              try {
                newContent = await fs.readFile(fullPath, 'utf-8');
              } catch {
                serverLogger.warn(`[RefreshDiffs] Could not read file: ${fullPath}`);
              }
            } else {
              // For modified files, get both old and new content
              try {
                newContent = await fs.readFile(fullPath, 'utf-8');
              } catch {
                serverLogger.warn(`[RefreshDiffs] Could not read file: ${fullPath}`);
              }
              
              // Try to get old content using git show
              try {
                const { stdout } = await execAsync(
                  `git show HEAD:"${filePath}"`,
                  { cwd: worktreePath, maxBuffer: 5 * 1024 * 1024 }
                );
                oldContent = stdout;
              } catch {
                // File might be new
                oldContent = "";
              }
            }
          } catch (error) {
            serverLogger.warn(`[RefreshDiffs] Error reading file contents for ${filePath}:`, error);
          }
        }
        
        // Decide whether to omit large content to respect Convex 1 MiB limit
        const patchSize = !isBinary && patch ? Buffer.byteLength(patch, 'utf8') : 0;
        const oldSize = oldContent ? Buffer.byteLength(oldContent, 'utf8') : 0;
        const newSize = newContent ? Buffer.byteLength(newContent, 'utf8') : 0;
        const totalApprox = patchSize + oldSize + newSize;
        const MAX_DOC_SIZE = 950 * 1024; // keep margin under 1 MiB
        let payload: any = {
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
          // Try keep patch if alone it's small
          payload.patch = patchSize < MAX_DOC_SIZE ? patch : undefined;
          payload.oldContent = undefined;
          payload.newContent = undefined;
          payload.contentOmitted = true;
        } else {
          payload.contentOmitted = false;
        }

        toStore.push(payload);
        serverLogger.info(`[RefreshDiffs] Prepared diff for ${filePath}: ${status} (+${additions}/-${deletions})`);
      }
      
      // Also process files from git status that might not be in the diff
      const statusLines = gitStatus.split('\n').filter(Boolean);
      for (const statusLine of statusLines) {
        const [statusCode, ...pathParts] = statusLine.trim().split(/\s+/);
        const filePath = pathParts.join(' ');
        
        if (!filePath) continue;
        
        // Check if we already processed this file
        const alreadyProcessed = diffSections.some(section => 
          section.includes(filePath)
        );
        
        if (alreadyProcessed) continue;
        
        // Map git status codes to our status types
        let status: "added" | "modified" | "deleted" | "renamed" = "modified";
        if (statusCode.includes('A') || statusCode === '??') {
          status = "added";
        } else if (statusCode.includes('D')) {
          status = "deleted";
        } else if (statusCode.includes('R')) {
          status = "renamed";
        }
        
        // Get file content for untracked files
        let newContent = "";
        if (status === "added" && statusCode === '??') {
          try {
            const fullPath = path.join(worktreePath, filePath);
            newContent = await fs.readFile(fullPath, 'utf-8');
          } catch {
            // File might not be readable
          }
        }
        
        toStore.push({
          filePath,
          status,
          additions: 0,
          deletions: 0,
          oldContent: "",
          newContent,
          isBinary: false,
          contentOmitted: false,
        });
        serverLogger.info(`[RefreshDiffs] Prepared status-only diff for ${filePath}: ${status}`);
      }

      // Bulk replace in a single mutation
      await convex.mutation(api.gitDiffs.replaceForTaskRun, {
        taskRunId: taskRunId as Id<"taskRuns">,
        diffs: toStore,
      });
      
      // Update the timestamp
      await convex.mutation(api.gitDiffs.updateDiffsTimestamp, {
        taskRunId: taskRunId as Id<"taskRuns">,
      });
      
      const fileCount = diffSections.length + statusLines.filter(l => !diffSections.some(s => s.includes(l.split(/\s+/).slice(1).join(' ')))).length;
      return { 
        success: true, 
        message: `Refreshed ${fileCount} file diffs` 
      };
    } else {
      return { 
        success: true, 
        message: "No changes detected" 
      };
    }
  } catch (error) {
    serverLogger.error(`[RefreshDiffs] Error refreshing diffs:`, error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}
