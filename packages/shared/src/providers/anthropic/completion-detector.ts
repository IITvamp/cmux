import type { FSWatcher } from "node:fs";

export function startClaudeCompletionDetector(
  taskRunId: string
): Promise<void> {
  const markerPath = `/root/lifecycle/claude-complete-${taskRunId}`;
  let watcher: FSWatcher | null = null;
  let stopped = false;

  console.log(`[Claude Detector] Starting completion detector for ${taskRunId}, watching for ${markerPath}`);

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

        // Check if marker already exists
        try {
          await fsp.access(markerPath);
          console.log(`[Claude Detector] Marker file already exists: ${markerPath}`);
          if (!stopped) {
            stop();
            resolve();
            return;
          }
        } catch {
          console.log(`[Claude Detector] Marker file not found yet: ${markerPath}`);
        }

        // Check if lifecycle directory exists
        try {
          await fsp.access("/root/lifecycle");
          console.log(`[Claude Detector] Lifecycle directory exists`);
        } catch (e) {
          console.log(`[Claude Detector] Lifecycle directory does not exist: ${e}`);
        }

        try {
          console.log(`[Claude Detector] Setting up file watcher on /root/lifecycle`);
          watcher = watch(
            "/root/lifecycle",
            { persistent: false },
            (event, filename) => {
              console.log(`[Claude Detector] File event: ${event} on ${filename}`);
              if (stopped) {
                console.log(`[Claude Detector] Watcher stopped, ignoring event`);
                return;
              }
              if (filename?.toString() === `claude-complete-${taskRunId}`) {
                console.log(`[Claude Detector] Found completion marker! ${filename}`);
                stop();
                resolve();
              }
            }
          );
          console.log(`[Claude Detector] File watcher created successfully`);
        } catch (e) {
          console.error(`[Claude Detector] Failed to create watcher:`, e);
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    })();
  });
}
