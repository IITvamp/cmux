import { getShortId } from "@coderouter/shared";
import { persistentIframeManager } from "./persistentIframeManager";

/**
 * Preload iframes for task runs
 * @param taskRunIds - Array of task run IDs to preload
 * @returns Promise that resolves when all iframes are loaded
 */
export async function preloadTaskRunIframes(
  taskRunIds: string[]
): Promise<void> {
  const entries = taskRunIds.map((taskRunId) => {
    const shortId = getShortId(taskRunId);
    const url = `http://${shortId}.39378.localhost:3001/?folder=/root/workspace`;

    return {
      key: `task-run-${taskRunId}`,
      url,
      allow: "clipboard-read; clipboard-write",
    };
  });

  await persistentIframeManager.preloadMultiple(entries);
}

/**
 * Preload a single task run iframe
 * @param taskRunId - Task run ID to preload
 * @returns Promise that resolves when the iframe is loaded
 */
export async function preloadTaskRunIframe(taskRunId: string): Promise<void> {
  const shortId = getShortId(taskRunId);
  const url = `http://${shortId}.39378.localhost:3001/?folder=/root/workspace`;

  await persistentIframeManager.preloadIframe(`task-run-${taskRunId}`, url, {
    allow: "clipboard-read; clipboard-write",
  });
}

/**
 * Remove a task run iframe from memory
 * @param taskRunId - Task run ID to remove
 */
export function removeTaskRunIframe(taskRunId: string): void {
  persistentIframeManager.removeIframe(`task-run-${taskRunId}`);
}

/**
 * Get all currently loaded task run iframe keys
 * @returns Array of task run IDs that have loaded iframes
 */
export function getLoadedTaskRunIframes(): string[] {
  return persistentIframeManager
    .getLoadedKeys()
    .filter((key) => key.startsWith("task-run-"))
    .map((key) => key.replace("task-run-", ""));
}
