import { promises as fs } from "node:fs";

/**
 * Check if Claude has completed based on the stop hook marker file
 * @param taskId The task ID to check for
 * @returns true if the completion marker exists, false otherwise
 */
export async function checkClaudeStopHookCompletion(taskId: string): Promise<boolean> {
  const markerPath = `/tmp/cmux/claude-complete-${taskId}`;
  try {
    await fs.access(markerPath);
    console.log(`[Claude Detector] Stop hook marker found at ${markerPath}`);
    return true;
  } catch {
    // Marker doesn't exist yet - hook hasn't executed
    return false;
  }
}

// Legacy exports for backward compatibility (will be removed in future)
export function getClaudeProjectPath(workingDir: string): string {
  // No longer used - keeping for backward compatibility
  return "";
}

export async function checkClaudeProjectFileCompletion(
  projectPath?: string,
  workingDir?: string,
  minIdleTimeMs?: number
): Promise<boolean> {
  // No longer used - keeping for backward compatibility
  return false;
}