#!/usr/bin/env bun
/**
 * Tiny watcher for Gemini telemetry file.
 *
 * Detects a log record where:
 *  - attributes["event.name"] === "gemini_cli.next_speaker_check"
 *  - attributes["result"] === "user"
 * Optionally filters by session id via --session <id>.
 *
 * Usage:
 *   bun run scripts/watch-gemini-telemetry.ts --file ./gemini-telemetry.log
 *   bun run scripts/watch-gemini-telemetry.ts --file ./gemini-telemetry.log --session <session-id>
 *   bun run scripts/watch-gemini-telemetry.ts --file ./gemini-telemetry.log --from-start
 *
 * Default behavior starts tailing from end of file to avoid scanning huge logs.
 */

import { createReadStream, existsSync, statSync, watch } from "node:fs";
import type { FSWatcher } from "node:fs";
import { basename, dirname, resolve } from "node:path";

interface CliArgs {
  file: string;
  fromStart: boolean;
  session?: string;
}

const parseArgs = (argv: string[]): CliArgs => {
  const args: CliArgs = { file: "gemini-telemetry.log", fromStart: false };

  for (let i = 2; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === "--file" && i + 1 < argv.length) {
      args.file = argv[i + 1];
      i += 1;
    } else if (current === "--from-start" || current === "-A") {
      args.fromStart = true;
    } else if (current === "--session" && i + 1 < argv.length) {
      args.session = argv[i + 1];
      i += 1;
    } else if (current === "--help" || current === "-h") {
      console.log(
        "Usage: watch-gemini-telemetry --file <path> [--session <id>] [--from-start]",
      );
      process.exit(0);
    }
  }

  return args;
};

type JsonCallback = (record: unknown) => void;

// Stream JSON objects concatenated without commas by tracking brace depth.
class JsonStreamParser {
  private depth = 0;

  private inString = false;

  private escape = false;

  private collecting = false;

  private buffer = "";

  constructor(private readonly onObject: JsonCallback) {}

  push(chunk: string): void {
    for (let index = 0; index < chunk.length; index += 1) {
      const char = chunk[index];

      if (this.inString) {
        this.buffer += char;
        if (this.escape) {
          this.escape = false;
        } else if (char === "\\") {
          this.escape = true;
        } else if (char === "\"") {
          this.inString = false;
        }
        continue;
      }

      if (char === "\"") {
        this.inString = true;
        if (this.collecting) this.buffer += char;
        continue;
      }

      if (char === "{") {
        if (!this.collecting) {
          this.collecting = true;
          this.buffer = "{";
          this.depth = 1;
        } else {
          this.depth += 1;
          this.buffer += char;
        }
        continue;
      }

      if (char === "}") {
        if (this.collecting) {
          this.depth -= 1;
          this.buffer += char;
          if (this.depth === 0) {
            try {
              const parsed = JSON.parse(this.buffer);
              this.onObject(parsed);
            } catch {
              // Ignore parse errors and continue buffering.
            }
            this.collecting = false;
            this.buffer = "";
          }
        }
        continue;
      }

      if (this.collecting) {
        this.buffer += char;
      }
    }
  }
}

const matchesTarget = (record: unknown, targetSession?: string): boolean => {
  if (!record || typeof record !== "object") return false;
  const container = record as Record<string, unknown>;

  const attrsCandidate =
    container.attributes ??
    (container.resource as Record<string, unknown> | undefined)?.attributes ??
    (container.body as Record<string, unknown> | undefined)?.attributes ??
    container["attributes"];

  if (!attrsCandidate || typeof attrsCandidate !== "object") return false;
  const attrs = attrsCandidate as Record<string, unknown>;

  const eventName =
    (attrs["event.name"] as string | undefined) ??
    ((attrs.event as Record<string, unknown> | undefined)?.name as string | undefined) ??
    (attrs["event_name"] as string | undefined);

  const result = (attrs["result"] as string | undefined) ?? (attrs.result as string | undefined);
  const sessionId =
    (attrs["session.id"] as string | undefined) ??
    (attrs["sessionId"] as string | undefined) ??
    (attrs.sessionId as string | undefined);

  if (targetSession && sessionId !== targetSession) return false;
  return eventName === "gemini_cli.next_speaker_check" && result === "user";
};

const readSlice = async (
  filePath: string,
  parser: JsonStreamParser,
  start: number,
  end: number,
): Promise<void> => {
  if (end <= start) return;

  await new Promise<void>((resolve) => {
    const stream = createReadStream(filePath, {
      start,
      end: end - 1,
      encoding: "utf8",
    });

    stream.on("data", (chunk) => parser.push(chunk));
    stream.on("end", resolve);
    stream.on("error", resolve);
  });
};

const main = async (): Promise<void> => {
  const { file, fromStart, session } = parseArgs(process.argv);
  const filePath = resolve(process.cwd(), file);

  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  let position = 0;
  try {
    const stat = statSync(filePath);
    position = fromStart ? 0 : stat.size;
  } catch (error) {
    console.error(`Cannot stat file: ${(error as Error).message}`);
    process.exit(1);
  }

  const parser = new JsonStreamParser((record) => {
    if (matchesTarget(record, session)) {
      process.stdout.write("DONE\n");
      process.stdout.write("\u0007");
      process.exit(0);
    }
  });

  if (fromStart) {
    try {
      const stat = statSync(filePath);
      await readSlice(filePath, parser, 0, stat.size);
      position = stat.size;
    } catch {
      // Ignore initial read failures and continue watching.
    }
  }

  const directory = dirname(filePath);
  const targetName = basename(filePath);

  const onChange = async (): Promise<void> => {
    try {
      const stat = statSync(filePath);
      if (stat.size > position) {
        const previous = position;
        position = stat.size;
        await readSlice(filePath, parser, previous, stat.size);
      }
    } catch {
      // ignore transient stat errors (e.g. file rotation)
    }
  };

  let watcher: FSWatcher | undefined;
  try {
    watcher = watch(directory, (_eventType, filename) => {
      if (filename && filename.toString() === targetName) {
        void onChange();
      }
    });
  } catch (error) {
    console.error(`Unable to watch file: ${(error as Error).message}`);
    process.exit(1);
  }

  const cleanup = (): void => {
    try {
      watcher?.close();
    } catch {
      // ignore close errors
    }
  };

  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });

  process.on("SIGTERM", () => {
    cleanup();
    process.exit(143);
  });
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
