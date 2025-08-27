import type { FSWatcher } from "node:fs";

export function startOpenCodeCompletionDetector(
  taskRunId: string
): Promise<void> {
  const markerPath = `/root/lifecycle/opencode-complete-${taskRunId}`;
  let watcher: FSWatcher | null = null;
  let stopped = false;

  return new Promise<void>((resolve, reject) => {
    void (async () => {
      try {
        const fs = await import("node:fs");
        const { watch, promises: fsp } = fs;
        const stop = () => {
          stopped = true;
          try {
            watcher?.close();
          } catch {
            // ignore
          }
          watcher = null;
        };

        try {
          await fsp.access(markerPath);
          if (!stopped) {
            stop();
            resolve();
            return;
          }
        } catch {
          // ignore
        }
        try {
          watcher = watch(
            "/root/lifecycle",
            { persistent: false },
            (_event, filename) => {
              if (stopped) return;
              if (filename?.toString() === `opencode-complete-${taskRunId}`) {
                stop();
                resolve();
              }
            }
          );
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    })();
  });
}
