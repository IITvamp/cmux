import * as fs from "node:fs";

export function watchClaudeStopHookCompletion(options: {
  taskRunId: string;
  onComplete: () => void | Promise<void>;
  onError?: (err: Error) => void;
}): () => void {
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
