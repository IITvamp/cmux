import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

type FinishReason =
  | "end_turn"
  | "max_tokens"
  | "tool_use"
  | "stop_sequence"
  | "unknown"
  | string;

interface FinishPartLike {
  finish?: {
    reason?: FinishReason;
    time?: number; // epoch seconds
    [key: string]: unknown;
  };
}

/**
 * Try to parse a JSON line and extract a finish part if present.
 * The opencode DB serializes message parts; logs and JSONL may contain a `finish` part.
 */
function extractFinishPart(line: string): { reason?: FinishReason; timeMs?: number } | null {
  try {
    const obj = JSON.parse(line) as FinishPartLike & Record<string, unknown>;
    // Common shapes:
    //  - { parts: [{ type: "finish", reason: "end_turn", time: 1723600000 }] }
    //  - { finish: { reason: "end_turn", time: 1723600000 } }
    //  - nested in event.response.finish or message.finish
    if (obj.finish && typeof obj.finish === "object") {
      const t = (obj.finish as any).time;
      return {
        reason: (obj.finish as any).reason as FinishReason | undefined,
        timeMs: typeof t === "number" ? (t > 2_000_000_000 ? t : t * 1000) : undefined,
      };
    }

    const parts = (obj as any).parts as unknown;
    if (Array.isArray(parts)) {
      for (const p of parts) {
        if (!p) continue;
        if (p.type === "finish" || p.finish) {
          const reason = (p.finish?.reason ?? p.reason) as FinishReason | undefined;
          const t = p.finish?.time ?? p.time;
          return {
            reason,
            timeMs: typeof t === "number" ? (t > 2_000_000_000 ? t : t * 1000) : undefined,
          };
        }
      }
    }

    // Event-like payloads
    const event = (obj as any).event || (obj as any).payload || (obj as any).response;
    if (event && typeof event === "object") {
      const finish = (event as any).finish;
      if (finish && typeof finish === "object") {
        const t = (finish as any).time;
        return {
          reason: (finish as any).reason as FinishReason | undefined,
          timeMs: typeof t === "number" ? (t > 2_000_000_000 ? t : t * 1000) : undefined,
        };
      }
    }
  } catch {
    // ignore parse errors; we'll also try text heuristics below
  }

  // Text fallback: look for finish reason markers
  // e.g., "finish.reason":"end_turn" or finish_reason=end_turn
  const m = line.match(/finish\s*[:_]\s*\{?[^}]*reason\s*[:=]\s*"?([a-zA-Z0-9_\-]+)"?/);
  if (m && m[1]) {
    return { reason: m[1] };
  }
  return null;
}

/**
 * Enumerate candidate files where OpenCode may write logs/events.
 * We avoid strong assumptions and scan a small, bounded set.
 */
async function findCandidateEventFiles(workingDir?: string): Promise<string[]> {
  const home = os.homedir();
  const candidates: string[] = [];
  const tryDirs = [
    path.join(home, ".local", "share", "opencode"),
    path.join(home, ".config", "opencode"),
    path.join(home, ".opencode"),
  ];

  // Also look inside the workspace for logs/artifacts
  if (workingDir) {
    const wd = workingDir;
    const wdCandidates = [
      path.join(wd, "logs"),
      path.join(wd, ".cmux", "tmp"),
      wd,
    ];
    for (const d of wdCandidates) {
      tryDirs.push(d);
    }
  }

  for (const dir of tryDirs) {
    try {
      const entries = await fs.readdir(dir);
      for (const e of entries) {
        const full = path.join(dir, e);
        try {
          const st = await fs.stat(full);
          if (!st.isFile()) continue;
          // Prioritize JSON/JSONL/logs written recently and opencode-related names
          if (/(jsonl|json|log|txt)$/i.test(e) && /(open.?code|events|agent|turns|messages)/i.test(e)) {
            candidates.push(full);
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // dir may not exist
    }
  }

  // Sort by mtime desc to check freshest first
  const withStats: Array<{ p: string; mtime: number }> = [];
  for (const p of candidates) {
    try {
      const s = await fs.stat(p);
      withStats.push({ p, mtime: s.mtime.getTime() });
    } catch {
      // ignore
    }
  }
  withStats.sort((a, b) => b.mtime - a.mtime);
  return withStats.map((x) => x.p);
}

/**
 * Inspect opencode event/log files for a non-tool_use finish signal since a timestamp.
 * Returns true if a deterministic completion is observed.
 */
export async function checkOpencodeCompletionSince(
  sinceEpochMs: number,
  workingDir?: string
): Promise<boolean> {
  const files = await findCandidateEventFiles(workingDir);
  // Debug: log candidate files considered
  console.log(`[OpenCode Detector] Considering ${files.length} candidate files`, files.slice(0, 10));
  for (const file of files) {
    try {
      const stat = await fs.stat(file);
      if (stat.mtime.getTime() < sinceEpochMs) continue; // stale

      const content = await fs.readFile(file, "utf-8");
      const lines = content.split("\n").filter(Boolean);
      // Only scan last ~500 lines to bound work
      const window = lines.slice(Math.max(0, lines.length - 500));
      for (const line of window) {
        const fin = extractFinishPart(line);
        if (!fin) continue;
        if (fin.reason && String(fin.reason).toLowerCase() === "tool_use") {
          continue; // not final
        }
        if (fin.timeMs && fin.timeMs < sinceEpochMs) continue; // old
        // Found a finish without tool_use => task complete
        console.log(`[OpenCode Detector] Completion detected in ${file}`, fin);
        return true;
      }
    } catch {
      // ignore file read errors
    }
  }
  return false;
}

export default {
  checkOpencodeCompletionSince,
};
