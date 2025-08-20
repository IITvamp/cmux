#!/usr/bin/env node
/**
 * Tiny watcher for Gemini telemetry file.
 *
 * Detects a log record where:
 *  - attributes["event.name"] === "gemini_cli.next_speaker_check"
 *  - attributes["result"] === "user"
 * Optionally filters by session id via --session <id>.
 *
 * Usage:
 *   node scripts/watch-gemini-telemetry.js --file ./gemini-telemetry.log
 *   node scripts/watch-gemini-telemetry.js --file ./gemini-telemetry.log --session <session-id>
 *   node scripts/watch-gemini-telemetry.js --file ./gemini-telemetry.log --from-start
 *
 * Default behavior starts tailing from end of file to avoid scanning huge logs.
 */

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const args = { file: 'gemini-telemetry.log', fromStart: false, session: undefined };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file' && i + 1 < argv.length) {
      args.file = argv[++i];
    } else if (a === '--from-start' || a === '-A') {
      args.fromStart = true;
    } else if (a === '--session' && i + 1 < argv.length) {
      args.session = argv[++i];
    } else if (a === '--help' || a === '-h') {
      console.log('Usage: watch-gemini-telemetry --file <path> [--session <id>] [--from-start]');
      process.exit(0);
    }
  }
  return args;
}

// Stream JSON objects concatenated without commas by tracking brace depth.
class JsonStreamParser {
  constructor(onObject) {
    this.onObject = onObject;
    this.reset();
  }
  reset() {
    this.depth = 0;
    this.inString = false;
    this.escape = false;
    this.collecting = false;
    this.buf = '';
  }
  push(chunk) {
    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];
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
              const obj = JSON.parse(this.buf);
              this.onObject(obj);
            } catch (e) {
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

function matchesTarget(obj, targetSession) {
  if (!obj || typeof obj !== 'object') return false;
  const attrs = obj.attributes || obj.resource?.attributes || obj.body?.attributes || obj['attributes'];
  if (!attrs || typeof attrs !== 'object') return false;
  const eventName = attrs['event.name'] || attrs.event?.name || attrs['event_name'];
  const result = attrs['result'] || attrs.result;
  const sessionId = attrs['session.id'] || attrs['sessionId'] || attrs.sessionId;
  if (targetSession && sessionId !== targetSession) return false;
  return eventName === 'gemini_cli.next_speaker_check' && result === 'user';
}

async function main() {
  const { file, fromStart, session } = parseArgs(process.argv);
  const filePath = path.resolve(process.cwd(), file);

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  let position = 0;
  try {
    const stat = fs.statSync(filePath);
    position = fromStart ? 0 : stat.size; // tail from end by default
  } catch (e) {
    console.error(`Cannot stat file: ${e.message}`);
    process.exit(1);
  }

  const parser = new JsonStreamParser((obj) => {
    if (matchesTarget(obj, session)) {
      // Print DONE and a bell character for audible notification if supported
      process.stdout.write('DONE\n');
      process.stdout.write('\x07');
      process.exit(0);
    }
  });

  // Read the initial segment if starting from beginning
  function readSlice(start, end) {
    return new Promise((resolve) => {
      if (end <= start) return resolve();
      const rs = fs.createReadStream(filePath, { start, end: end - 1, encoding: 'utf8' });
      rs.on('data', (chunk) => parser.push(chunk));
      rs.on('end', resolve);
      rs.on('error', () => resolve());
    });
  }

  if (fromStart) {
    try {
      const stat = fs.statSync(filePath);
      await readSlice(0, stat.size);
      position = stat.size;
    } catch (e) {
      // ignore
    }
  }

  // Watch for appends and read new data
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const onChange = async () => {
    let stat;
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

  // Initial read might have already matched; if not, continue watching
  const watcher = fs.watch(dir, (eventType, filename) => {
    if (filename && filename.toString() === base) {
      onChange();
    }
  });

  const cleanup = () => {
    try { watcher.close(); } catch {}
  };
  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  process.on('SIGTERM', () => { cleanup(); process.exit(143); });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});