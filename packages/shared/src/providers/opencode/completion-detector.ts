import * as fs from "node:fs";

export function watchOpenCodeMarkerFile(options: {
  taskRunId: string;
  onComplete: () => void | Promise<void>;
  onError?: (err: Error) => void;
}): () => void {
  const { watch } = fs;
  const { promises: fsp } = fs;
  const markerPath = `/root/lifecycle/opencode-complete-${options.taskRunId}`;
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
      await fsp.access(markerPath);
      if (!stopped) {
        await options.onComplete();
        stop();
        return;
      }
    } catch {
      // ignore
    }
    try {
      watcher = watch(
        "/root/lifecycle",
        { persistent: false },
        async (_event, filename) => {
          if (stopped) return;
          if (
            filename?.toString() === `opencode-complete-${options.taskRunId}`
          ) {
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

export function startOpenCodeCompletionDetector(
  taskRunId: string,
  onComplete: () => void
): void {
  watchOpenCodeMarkerFile({ taskRunId, onComplete });
}
