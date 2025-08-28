import type { FSWatcher } from "node:fs";

// Watch Qwen CLI local telemetry for the "next speaker: user" signal.
// Mirrors the Gemini detector but targets a Qwen-specific outfile.
export function startQwenCompletionDetector(taskRunId: string): Promise<void> {
  const telemetryPath = `/tmp/qwen-telemetry-${taskRunId}.log`;
  let fileWatcher: FSWatcher | null = null;
  let dirWatcher: FSWatcher | null = null;

  return new Promise<void>((resolve) => {
    void (async () => {
      const path = await import("node:path");
      const fs = await import("node:fs");
      const { watch, createReadStream, promises: fsp } = fs;

      let stopped = false;
      let lastSize = 0;

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
          (anyEvent.body &&
            (anyEvent.body as Record<string, unknown>).attributes);
        if (!attrs || typeof attrs !== "object") return false;
        const a = attrs as Record<string, unknown>;
        const eventName = (a["event.name"] || a["event_name"]) as
          | string
          | undefined;
        const result = a["result"] as string | undefined;

        // Accept both Gemini-style and Qwen-style event namespaces, and a generic suffix.
        const nameOk = Boolean(
          eventName === "gemini_cli.next_speaker_check" ||
            eventName === "qwen_cli.next_speaker_check" ||
            (typeof eventName === "string" &&
              eventName.endsWith(".next_speaker_check"))
        );
        return nameOk && result === "user";
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
          await new Promise<void>((r) => {
            const rs = createReadStream(telemetryPath, {
              start,
              end,
              encoding: "utf-8",
            });
            rs.on("data", (chunk: string | Buffer) => {
              const text =
                typeof chunk === "string" ? chunk : chunk.toString("utf-8");
              feed(text, (obj) => {
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
                    resolve();
                  }
                } catch {
                  // ignore
                }
              });
            });
            rs.on("end", () => r());
            rs.on("error", () => r());
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
    })();
  });
}

