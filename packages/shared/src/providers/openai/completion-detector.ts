import type { FSWatcher } from "node:fs";

export async function createCodexDetector(options: {
  taskRunId: string;
  startTime: number;
  workingDir?: string;
}): Promise<void> {
  const doneFilePath = "/root/lifecycle/codex-done.txt";
  const path = await import("node:path");
  const dir = path.dirname(doneFilePath);
  let isRunning = true;
  let watcher: FSWatcher | undefined;

  return new Promise<void>((resolve) => {
    void (async () => {
      const fs = await import("node:fs");
      const stop = () => {
        if (!isRunning) return;
        isRunning = false;
        if (watcher) {
          try {
            watcher.close();
          } catch {
            // ignore
          }
          watcher = undefined;
        }
        console.log(`[Codex Detector] Stopped watching ${doneFilePath}`);
      };

      const handleCompletion = () => {
        if (!isRunning) return;
        const elapsedMs = Date.now() - options.startTime;
        console.log(`[Codex Detector] Task completed after ${elapsedMs}ms`);
        stop();
        resolve();
      };

      console.log(`[Codex Detector] Starting for task ${options.taskRunId}`);
      console.log(`[Codex Detector] Watching for ${doneFilePath}`);

      // Ensure directory exists
      try {
        await fs.promises.mkdir(dir, { recursive: true });
      } catch {
        // ignore
      }

      // If file already present, fire immediately
      if (fs.existsSync(doneFilePath)) {
        console.log(
          `[Codex Detector] Done file already exists, marking complete`
        );
        handleCompletion();
        return;
      }

      // Watch for filesystem events
      watcher = fs.watch(dir, (eventType, filename) => {
        if (!isRunning) return;
        console.log(
          `[Codex Detector] Directory event: ${eventType}, file: ${filename}`
        );
        // Some platforms may emit undefined filename; check on any event
        if (
          (filename === "codex-done.txt" || !filename) &&
          fs.existsSync(doneFilePath)
        ) {
          console.log(`[Codex Detector] ✅ Task complete - done file exists`);
          handleCompletion();
        }
      });
    })();
  });
}

export function startCodexCompletionDetector(taskRunId: string): Promise<void> {
  return createCodexDetector({
    taskRunId,
    startTime: Date.now(),
  });
}
