import * as fs from "node:fs";
import * as path from "node:path";

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
        { persistent: false, encoding: "utf8" },
        (eventType: string) => {
          if (!stopped && eventType === "change") {
            void readNew(false);
          }
        }
      );
    } catch {
      // not created yet
    }
  };

  dirWatcher = watch(
    dir,
    { persistent: false, encoding: "utf8" },
    (_eventType: string, filename: string | null) => {
      const name = filename;
      if (!stopped && name === file) {
        void attachFileWatcher();
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
