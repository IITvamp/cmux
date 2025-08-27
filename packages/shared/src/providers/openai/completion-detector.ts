import * as fs from "node:fs";
import type { FSWatcher } from "node:fs";
import * as path from "node:path";

export type CodexDetectorHandle = { stop: () => void };

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
}): Promise<CodexDetectorHandle> {
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
    return { stop };
  }

  // Watch for filesystem events
  watcher = fs.watch(dir, (eventType, filename) => {
    if (!isRunning) return;
    console.log(`[Codex Detector] Directory event: ${eventType}, file: ${filename}`);
    // Some platforms may emit undefined filename; check on any event
    if ((filename === "codex-done.txt" || !filename) && fs.existsSync(doneFilePath)) {
      console.log(`[Codex Detector] ✅ Task complete - done file exists`);
      handleCompletion();
    }
  });

  return { stop };
}

// Consolidated from completion-detection.ts
export type StopFn = () => void;

export async function watchCodexDoneFile(options: {
  taskRunId: string;
  startTime: number;
  workingDir?: string;
  onComplete: (data: { elapsedMs: number }) => void;
  onError?: (error: Error) => void;
}): Promise<StopFn> {
  let handle: CodexDetectorHandle | null = null;
  try {
    handle = await createCodexDetector({
      taskRunId: options.taskRunId,
      startTime: options.startTime,
      workingDir: options.workingDir,
      onComplete: (data) => options.onComplete({ elapsedMs: data.elapsedMs }),
      onError: options.onError,
    });
  } catch (e) {
    options.onError?.(e instanceof Error ? e : new Error(String(e)));
  }
  return () => {
    try {
      handle?.stop();
    } catch {}
  };
}

export function startCodexCompletionDetector(
  taskRunId: string,
  onComplete: () => void
): void {
  (async () => {
    try {
      const handle: CodexDetectorHandle = await createCodexDetector({
        taskRunId,
        startTime: Date.now(),
        onComplete: () => onComplete(),
      });
      // Ensure the detector stops itself when complete via its own callback
      // but do not expose a handle to the caller per project design.
      // For safety, stop after 30m if not complete.
      setTimeout(() => {
        try {
          handle.stop();
        } catch {}
      }, 30 * 60 * 1000);
    } catch {}
  })();
}
