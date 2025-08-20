import { EventEmitter } from "node:events";
import { watch, existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import * as path from "node:path";
export class CodexCompletionDetector extends EventEmitter {
  private isRunning = false;
  private doneFilePath = "/root/lifecycle/codex-done.txt";
  private watcher?: any;

  constructor(
    private options: {
      taskRunId: string;
      startTime: number;
      workingDir?: string;
    }
  ) {
    super();
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log(`[Codex Detector] Starting for task ${this.options.taskRunId}`);
    console.log(`[Codex Detector] Watching for ${this.doneFilePath}`);

    // Check if file already exists
    if (existsSync(this.doneFilePath)) {
      console.log(`[Codex Detector] Done file already exists, marking complete`);
      this.handleCompletion();
      return;
    }

    this.setupWatcher();
  }

  private setupWatcher(): void {
    const dir = path.dirname(this.doneFilePath);

    console.log(`[Codex Detector] Setting up watcher for ${this.doneFilePath}`);

    // Create directory if it doesn't exist
    fs.mkdir(dir, { recursive: true }).catch(() => {});

    // Watch the directory for the done file
    this.watcher = watch(dir, (eventType, filename) => {
      console.log(`[Codex Detector] Directory event: ${eventType}, file: ${filename}`);
      
      if (filename === "codex-done.txt") {
        console.log(`[Codex Detector] Done file detected!`);
        
        // Verify file exists
        if (existsSync(this.doneFilePath)) {
          console.log(`[Codex Detector] ✅ Task complete - done file exists`);
          this.handleCompletion();
        }
      }
    });

    // Also poll periodically as a fallback
    const pollInterval = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(pollInterval);
        return;
      }

      if (existsSync(this.doneFilePath)) {
        console.log(`[Codex Detector] ✅ Task complete - done file found via polling`);
        clearInterval(pollInterval);
        this.handleCompletion();
      }
    }, 2000); // Check every 2 seconds
  }

  private handleCompletion(): void {
    if (!this.isRunning) return;
    
    const elapsedMs = Date.now() - this.options.startTime;
    console.log(`[Codex Detector] Task completed after ${elapsedMs}ms`);
    
    this.stop();
    this.emit("complete", {
      taskRunId: this.options.taskRunId,
      elapsedMs,
      detectionMethod: "done-file"
    });
  }

  stop(): void {
    this.isRunning = false;
    
    // Stop watching
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }
    
    console.log(`[Codex Detector] Stopped watching ${this.doneFilePath}`);
  }
}

export async function createCodexDetector(options: {
  taskRunId: string;
  startTime: number;
  workingDir?: string;
  onComplete: (data: { taskRunId: string; elapsedMs: number; detectionMethod: string }) => void;
  onError?: (error: Error) => void;
}): Promise<CodexCompletionDetector> {
  const detector = new CodexCompletionDetector({
    taskRunId: options.taskRunId,
    startTime: options.startTime,
    workingDir: options.workingDir,
  });

  detector.on("complete", options.onComplete);
  if (options.onError) {
    detector.on("error", options.onError);
  }

  await detector.start();
  return detector;
}