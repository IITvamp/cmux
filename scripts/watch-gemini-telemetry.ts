#!/usr/bin/env -S node --enable-source-maps
/**
 * Tiny watcher for Gemini telemetry file (TypeScript version).
 *
 * Detects a log record where:
 *  - attributes["event.name"] === "gemini_cli.next_speaker_check"
 *  - attributes["result"] === "user"
 * Optionally filters by session id via --session <id>.
 *
 * Usage examples:
 *   bun run tsx scripts/watch-gemini-telemetry.ts --file ./gemini-telemetry.log
 *   bun run tsx scripts/watch-gemini-telemetry.ts --file ./gemini-telemetry.log --session <session-id>
 *   bun run tsx scripts/watch-gemini-telemetry.ts --file ./gemini-telemetry.log --from-start
 *
 * By default it tails from the end of file to avoid scanning huge logs.
 */

import { createReadStream, existsSync, statSync, watch } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

type Args = {
  file: string;
  fromStart: boolean;
  session?: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { file: 'gemini-telemetry.log', fromStart: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file' && i + 1 < argv.length) {
      args.file = argv[++i]!;
    } else if (a === '--from-start' || a === '-A') {
      args.fromStart = true;
    } else if (a === '--session' && i + 1 < argv.length) {
      args.session = argv[++i]!;
    } else if (a === '--help' || a === '-h') {
      // eslint-disable-next-line no-console
      console.log('Usage: watch-gemini-telemetry --file <path> [--session <id>] [--from-start]');
      process.exit(0);
    }
  }
  return args;
}

// Stream JSON objects concatenated without commas by tracking brace depth.
class JsonStreamParser<T extends object> {
  private depth = 0;
  private inString = false;
  private escape = false;
  private collecting = false;
  private buf = '';

  constructor(private readonly onObject: (obj: T) => void) {}

  push(chunk: string): void {
    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i]!;
      if (this.inString) {
        this.buf += ch;
        if (this.escape) {
          this.escape = false;
        } else if (ch === '\\') {
          this.escape = true;
        } else if (ch === '"') {
          this.inString = false;
        }
        continue;
      }
      // Not in string
      if (ch === '"') {
        this.inString = true;
        if (this.collecting) this.buf += ch;
        continue;
      }
      if (ch === '{') {
        if (!this.collecting) {
          this.collecting = true;
          this.buf = '{';
          this.depth = 1;
        } else {
          this.depth++;
          this.buf += ch;
        }
        continue;
      }
      if (ch === '}') {
        if (this.collecting) {
          this.depth--;
          this.buf += ch;
          if (this.depth === 0) {
            // Complete JSON object
            try {
              const obj = JSON.parse(this.buf) as T;
              this.onObject(obj);
            } catch {
              // Ignore parse error; continue
            }
            this.collecting = false;
            this.buf = '';
          }
        }
        continue;
      }
      if (this.collecting) {
        this.buf += ch;
      }
    }
  }
}

type TelemetryObj = {
  attributes?: Record<string, unknown> & {
    'event.name'?: unknown;
    result?: unknown;
    'session.id'?: unknown;
  };
  resource?: { attributes?: Record<string, unknown> };
  body?: { attributes?: Record<string, unknown> };
  [key: string]: unknown;
};

function matchesTarget(obj: TelemetryObj, targetSession?: string): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const attrs =
    obj.attributes || obj.resource?.attributes || obj.body?.attributes || (obj as Record<string, unknown>)['attributes'];
  if (!attrs || typeof attrs !== 'object') return false;
  const a = attrs as Record<string, unknown>;
  const eventName = (a['event.name'] ?? (a.event as Record<string, unknown> | undefined)?.name ?? a['event_name']) as
    | string
    | undefined;
  const result = (a['result'] ?? a.result) as string | undefined;
  const sessionId = (a['session.id'] ?? (a as Record<string, unknown>)['sessionId']) as string | undefined;
  if (targetSession && sessionId !== targetSession) return false;
  return eventName === 'gemini_cli.next_speaker_check' && result === 'user';
}

async function main(): Promise<void> {
  const { file, fromStart, session } = parseArgs(process.argv);
  const filePath = resolve(process.cwd(), file);

  if (!existsSync(filePath)) {
    // eslint-disable-next-line no-console
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  let position = 0;
  try {
    const stat = statSync(filePath);
    position = fromStart ? 0 : stat.size; // tail from end by default
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`Cannot stat file: ${(e as Error).message}`);
    process.exit(1);
  }

  const parser = new JsonStreamParser<TelemetryObj>((obj) => {
    if (matchesTarget(obj, session)) {
      // Print DONE and a bell character for audible notification if supported
      process.stdout.write('DONE\n');
      process.stdout.write('\x07');
      process.exit(0);
    }
  });

  // Read the initial segment if starting from beginning
  function readSlice(start: number, end: number): Promise<void> {
    return new Promise((resolve) => {
      if (end <= start) return resolve();
      const rs = createReadStream(filePath, { start, end: end - 1, encoding: 'utf8' });
      rs.on('data', (chunk: string) => parser.push(chunk));
      rs.on('end', resolve);
      rs.on('error', () => resolve());
    });
  }

  if (fromStart) {
    try {
      const stat = statSync(filePath);
      await readSlice(0, stat.size);
      position = stat.size;
    } catch {
      // ignore
    }
  }

  // Watch for appends and read new data
  const dir = dirname(filePath);
  const base = basename(filePath);
  const onChange = async (): Promise<void> => {
    let st;
    try {
      st = statSync(filePath);
    } catch {
      return;
    }
    if (st.size > position) {
      const oldPos = position;
      position = st.size;
      await readSlice(oldPos, st.size);
    }
  };

  // Initial read might have already matched; if not, continue watching
  const watcher = watch(dir, (eventType, filename) => {
    if (filename && filename.toString() === base) void onChange();
  });

  const cleanup = (): void => {
    try {
      watcher.close();
    } catch {
      /* noop */
    }
  };
  process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(143);
  });
}

void main().catch((e: unknown) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

