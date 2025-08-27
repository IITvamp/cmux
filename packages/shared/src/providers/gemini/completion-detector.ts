import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getLastJsonlObject } from "../../utils/jsonl.js";

/**
 * Gemini session/message types (best-effort)
 * The Gemini CLI may log JSONL transcripts under a provider-specific location.
 * We mirror the Claude detector pattern and look for JSONL in a per-project folder.
 */
interface GeminiMessageLike {
  role?: string; // "user" | "assistant" | "model" | unknown
  content?: string;
  timestamp?: string;
  // Additional fields ignored
  [key: string]: unknown;
}

// Compute a project path we expect Gemini CLI to use for transcripts.
// This mirrors the Claude convention, using an encoded working dir.
export function getGeminiProjectPath(workingDir: string): string {
  const homeDir = os.homedir();
  const encoded = workingDir.replace(/\//g, "-");
  return path.join(homeDir, ".gemini", "projects", encoded);
}

async function getMostRecentJsonlFile(
  projectDir: string
): Promise<string | null> {
  try {
    await fs.promises.access(projectDir);
  } catch {
    return null;
  }
  try {
    const files = await fs.promises.readdir(projectDir);
    const jsonlFiles = files
      .filter((f) => f.endsWith(".jsonl"))
      .sort((a, b) => b.localeCompare(a));
    if (!jsonlFiles.length) return null;
    const first = jsonlFiles[0];
    if (!first) return null;
    return path.join(projectDir, first);
  } catch {
    return null;
  }
}

async function getLastMessage(
  filePath: string
): Promise<GeminiMessageLike | null> {
  const obj = await getLastJsonlObject<GeminiMessageLike>(filePath);
  if (!obj) return null;
  const role = obj.role;
  let content = obj.content;
  if (!content && typeof obj.text === "string") content = obj.text;
  return { ...obj, role, content };
}

/**
 * Heuristic completion detection for Gemini CLI transcripts.
 * Considered complete when:
 * - The most recent message is from the assistant/model, and
 * - The session has been idle for at least `minIdleTimeMs`, and
 * - Optionally, the last message includes a completion phrase.
 */
export async function checkGeminiProjectFileCompletion(
  projectPath?: string,
  workingDir?: string,
  minIdleTimeMs: number = 10000
): Promise<boolean> {
  const projectDir =
    projectPath || (workingDir ? getGeminiProjectPath(workingDir) : null);
  if (!projectDir)
    throw new Error("Either projectPath or workingDir must be provided");

  const jsonl = await getMostRecentJsonlFile(projectDir);
  if (!jsonl) return false;

  const last = await getLastMessage(jsonl);
  if (!last) return false;

  const role = (last.role || "").toLowerCase();
  const isAssistant = role === "assistant" || role === "model";
  if (!isAssistant) return false;

  // Idle check if timestamp available
  if (last.timestamp) {
    const ts = Date.parse(last.timestamp);
    if (!Number.isNaN(ts)) {
      const idle = Date.now() - ts;
      if (idle < minIdleTimeMs) return false;
    }
  }

  return true;
}

export default {
  getGeminiProjectPath,
  checkGeminiProjectFileCompletion,
};

/**
 * Event-driven watcher for Gemini completion via telemetry file.
 * Uses fs.watch + createReadStream to stream appended bytes and detect
 * the completion event immediately
 */
export function watchGeminiTelemetryForCompletion(options: {
  telemetryPath: string;
  onComplete: () => void | Promise<void>;
  onError?: (error: Error) => void;
}): () => void {
  const { telemetryPath, onComplete, onError } = options;
  const { watch, createReadStream } = fs;
  const { promises: fsp } = fs;

  let stopped = false;
  let lastSize = 0;
  let fileWatcher: import("node:fs").FSWatcher | null = null;
  let dirWatcher: import("node:fs").FSWatcher | null = null;

  const dir = path.dirname(telemetryPath);
  const file = path.basename(telemetryPath);

  // Lightweight JSON object stream parser for concatenated objects
  let buf = "";
  let depth = 0;
  let inString = false;
  let escape = false;
  const feed = (chunk: string, onObject: (obj: unknown) => void) => {
    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];
      if (inString) {
        buf += ch;
        if (escape) {
          escape = false;
        } else if (ch === "\\") {
          escape = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
        if (depth > 0) buf += ch;
        continue;
      }
      if (ch === "{") {
        depth++;
        buf += ch;
        continue;
      }
      if (ch === "}") {
        depth--;
        buf += ch;
        if (depth === 0) {
          try {
            const obj = JSON.parse(buf);
            onObject(obj);
          } catch {
            // ignore
          }
          buf = "";
        }
        continue;
      }
      if (depth > 0) buf += ch;
    }
  };

  const isCompletionEvent = (event: unknown): boolean => {
    if (!event || typeof event !== "object") return false;
    const anyEvent = event as Record<string, unknown>;
    const attrs =
      (anyEvent.attributes as Record<string, unknown>) ||
      (anyEvent.resource &&
        (anyEvent.resource as Record<string, unknown>).attributes) ||
      (anyEvent.body && (anyEvent.body as Record<string, unknown>).attributes);
    if (!attrs || typeof attrs !== "object") return false;
    const eventName =
      (attrs as Record<string, unknown>)["event.name"] ||
      (attrs as Record<string, unknown>)["event_name"];
    const result = (attrs as Record<string, unknown>).result as
      | string
      | undefined;
    return eventName === "gemini_cli.next_speaker_check" && result === "user";
  };

  const readNew = async (initial = false) => {
    try {
      const st = await fsp.stat(telemetryPath);
      const start = initial ? 0 : lastSize;
      if (st.size <= start) {
        lastSize = st.size;
        return;
      }
      const end = st.size - 1;
      await new Promise<void>((resolve) => {
        const rs = createReadStream(telemetryPath, {
          start,
          end,
          encoding: "utf-8",
        });
        rs.on("data", (chunk: string | Buffer) => {
          const text =
            typeof chunk === "string" ? chunk : chunk.toString("utf-8");
          feed(text, async (obj) => {
            try {
              if (!stopped && isCompletionEvent(obj)) {
                stopped = true;
                try {
                  fileWatcher?.close();
                } catch {
                  // ignore
                }
                try {
                  dirWatcher?.close();
                } catch {
                  // ignore
                }
                await onComplete();
              }
            } catch (e) {
              onError?.(e instanceof Error ? e : new Error(String(e)));
            }
          });
        });
        rs.on("end", () => resolve());
        rs.on("error", () => resolve());
      });
      lastSize = st.size;
    } catch {
      // until file exists
    }
  };

  const attachFileWatcher = async () => {
    try {
      const st = await fsp.stat(telemetryPath);
      lastSize = st.size;
      await readNew(true);
      fileWatcher = watch(
        telemetryPath,
        { persistent: false },
        async (eventType: string) => {
          if (!stopped && eventType === "change") {
            await readNew(false);
          }
        }
      );
    } catch {
      // not created yet
    }
  };

  dirWatcher = watch(
    dir,
    { persistent: false },
    async (_eventType: string, filename: string | Buffer) => {
      const name = filename?.toString();
      if (!stopped && name === file) {
        await attachFileWatcher();
      }
    }
  );

  void attachFileWatcher();

  return () => {
    stopped = true;
    try {
      fileWatcher?.close();
    } catch {
      // ignore
    }
    try {
      dirWatcher?.close();
    } catch {
      // ignore
    }
  };
}

// Consolidated from completion-detection.ts
export function startGeminiCompletionDetector(
  taskRunId: string,
  onComplete: () => void
): void {
  const telemetryPath = `/tmp/gemini-telemetry-${taskRunId}.log`;
  watchGeminiTelemetryForCompletion({ telemetryPath, onComplete });
}
