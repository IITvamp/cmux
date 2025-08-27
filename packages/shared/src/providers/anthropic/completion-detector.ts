import * as fs from "node:fs";

/**
 * Check if Claude has completed based on the stop hook marker file
 * @param taskRunId The task run ID to check for
 * @returns true if the completion marker exists, false otherwise
 */
export async function checkClaudeStopHookCompletion(
  taskRunId: string
): Promise<boolean> {
  const markerPath = `/root/lifecycle/claude-complete-${taskRunId}`;
  try {
    await fs.promises.access(markerPath);
    console.log(`[Claude Detector] Stop hook marker found at ${markerPath}`);
    return true;
  } catch {
    // Marker doesn't exist yet - hook hasn't executed
    return false;
  }
}

// Consolidated from completion-detection.ts
export type StopFn = () => void;

export function watchClaudeStopHookCompletion(options: {
  taskRunId: string;
  onComplete: () => void | Promise<void>;
  onError?: (err: Error) => void;
}): StopFn {
  const markerPath = `/root/lifecycle/claude-complete-${options.taskRunId}`;
  let watcher: import("node:fs").FSWatcher | null = null;
  let stopped = false;

  const stop = () => {
    stopped = true;
    try {
      watcher?.close();
    } catch {
      // ignore
    }
    watcher = null;
  };

  (async () => {
    try {
      // Fire immediately if exists
      await fs.promises.access(markerPath);
      if (!stopped) {
        await options.onComplete();
        stop();
        return;
      }
    } catch {
      // not there yet
    }

    try {
      watcher = fs.watch(
        "/root/lifecycle",
        { persistent: false },
        async (_event, filename) => {
          if (stopped) return;
          if (filename?.toString() === `claude-complete-${options.taskRunId}`) {
            try {
              await options.onComplete();
            } catch (e) {
              options.onError?.(e instanceof Error ? e : new Error(String(e)));
            }
            stop();
          }
        }
      );
    } catch (e) {
      options.onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  })();

  return stop;
}

export function startClaudeCompletionDetector(
  taskRunId: string,
  onComplete: () => void
): void {
  watchClaudeStopHookCompletion({
    taskRunId,
    onComplete,
  });
}
