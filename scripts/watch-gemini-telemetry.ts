#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

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
      args.session = argv[++i];
    } else if (a === '--help' || a === '-h') {
      // eslint-disable-next-line no-console
      console.log('Usage: watch-gemini-telemetry --file <path> [--session <id>] [--from-start]');
      process.exit(0);
    }
  }
  return args;
}

class JsonStreamParser {
  private onObject: (obj: unknown) => void;
  private depth = 0;
  private inString = false;
  private escape = false;
  private collecting = false;
  private buf = '';

  constructor(onObject: (obj: unknown) => void) {
    this.onObject = onObject;
  }

  push(chunk: string): void {
    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i] as string;
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
            try {
              const obj = JSON.parse(this.buf) as unknown;
              this.onObject(obj);
            } catch {
              // ignore parse errors
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

function matchesTarget(obj: unknown, targetSession?: string): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const anyObj = obj as Record<string, unknown>;
  const attrs = (anyObj.attributes as Record<string, unknown> | undefined)
    ?? ((anyObj.resource as Record<string, unknown> | undefined)?.attributes as Record<string, unknown> | undefined)
    ?? (anyObj.body as Record<string, unknown> | undefined)?.attributes as Record<string, unknown> | undefined
    ?? (anyObj['attributes'] as Record<string, unknown> | undefined);
  if (!attrs) return false;
  const eventName = (attrs['event.name'] as string)
    ?? ((attrs as Record<string, unknown>).event as Record<string, unknown> | undefined)?.name as string | undefined
    ?? (attrs['event_name'] as string | undefined);
  const result = (attrs['result'] as string) ?? (attrs.result as string | undefined);
  const sessionId = (attrs['session.id'] as string)
    ?? (attrs['sessionId'] as string | undefined)
    ?? (attrs as Record<string, unknown>).sessionId as string | undefined;
  if (targetSession && sessionId !== targetSession) return false;
  return eventName === 'gemini_cli.next_speaker_check' && result === 'user';
}

async function main(): Promise<void> {
  const { file, fromStart, session } = parseArgs(process.argv);
  const filePath = path.resolve(process.cwd(), file);

  if (!fs.existsSync(filePath)) {
    // eslint-disable-next-line no-console
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  let position = 0;
  try {
    const stat = fs.statSync(filePath);
    position = fromStart ? 0 : stat.size;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`Cannot stat file: ${(e as Error).message}`);
    process.exit(1);
  }

  const parser = new JsonStreamParser((obj) => {
    if (matchesTarget(obj, session)) {
      process.stdout.write('DONE\n');
      process.stdout.write('\x07');
      process.exit(0);
    }
  });

  function readSlice(start: number, end: number): Promise<void> {
    return new Promise((resolve) => {
      if (end <= start) return resolve();
      const rs = fs.createReadStream(filePath, { start, end: end - 1, encoding: 'utf8' as BufferEncoding });
      rs.on('data', (chunk: string) => parser.push(chunk));
      rs.on('end', resolve);
      rs.on('error', () => resolve());
    });
  }

  if (fromStart) {
    try {
      const stat = fs.statSync(filePath);
      await readSlice(0, stat.size);
      position = stat.size;
    } catch {
      // ignore
    }
  }

  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const onChange = async (): Promise<void> => {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch {
      return;
    }
    if (stat.size > position) {
      const oldPos = position;
      position = stat.size;
      await readSlice(oldPos, stat.size);
    }
  };

  const watcher = fs.watch(dir, (_eventType, filename) => {
    if (filename && filename.toString() === base) {
      void onChange();
    }
  });

  const cleanup = (): void => {
    try { watcher.close(); } catch { /* noop */ }
  };
  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  process.on('SIGTERM', () => { cleanup(); process.exit(143); });
}

void main().catch((e: unknown) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

