import { promises as fs } from "node:fs";

/**
 * Check if Claude has completed based on the stop hook marker file
 * @param taskRunId The task run ID to check for
 * @returns true if the completion marker exists, false otherwise
 */
export async function checkClaudeStopHookCompletion(taskRunId: string): Promise<boolean> {
  const markerPath = `/root/lifecycle/claude-complete-${taskRunId}`;
  try {
    await fs.access(markerPath);
    console.log(`[Claude Detector] Stop hook marker found at ${markerPath}`);
    return true;
  } catch {
    // Marker doesn't exist yet - hook hasn't executed
    return false;
  }
}