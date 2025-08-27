import * as fs from "node:fs";
import type { FSWatcher } from "node:fs";
import * as path from "node:path";

export async function createCodexDetector(options: {
  taskRunId: string;
  startTime: number;
  workingDir?: string;
  onComplete: (data: {
    taskRunId: string;
    elapsedMs: number;
    detectionMethod: string;
  }) => void;
  onError?: (error: Error) => void;
}): Promise<void> {
  const doneFilePath = "/root/lifecycle/codex-done.txt";
  const dir = path.dirname(doneFilePath);
  let isRunning = true;
  let watcher: FSWatcher | undefined;

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
    try {
      options.onComplete({
        taskRunId: options.taskRunId,
        elapsedMs,
        detectionMethod: "done-file",
      });
    } catch (err) {
      if (options.onError && err instanceof Error) options.onError(err);
    }
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
    console.log(`[Codex Detector] Done file already exists, marking complete`);
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

  return;
}

export function startCodexCompletionDetector(
  taskRunId: string,
  onComplete: () => void
): void {
  (async () => {
    await createCodexDetector({
      taskRunId,
      startTime: Date.now(),
      onComplete: () => onComplete(),
    });
  })();
}
