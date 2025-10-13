import { RESERVED_CMUX_PORT_SET } from "@cmux/shared/utils/reserved-cmux-ports";
import { isLikelyDevServerCandidate } from "./devServerHeuristics";
import { log } from "./logger";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_POLL_INTERVAL_MS = 3_000;
const RESURFACE_INTERVAL_MS = 2 * 60 * 1_000;
const CMDLINE_CACHE_TTL_MS = 10_000;
const CMDLINE_CACHE_MAX_SIZE = 256;

export interface DevServerProcessInfo {
  port: number;
  pid: number;
  processName: string;
  cmdline: string | null;
}

interface DetectorOptions {
  pollIntervalMs?: number;
  workerId?: string;
  logger?: typeof log;
  onCandidate: (info: DevServerProcessInfo) => void | Promise<void>;
}

interface CmdlineCacheEntry {
  cmdline: string | null;
  capturedAt: number;
}

interface NotifiedEntry {
  pid: number;
  notifiedAt: number;
}

export class DevServerDetector {
  private readonly pollInterval: number;
  private readonly workerId?: string;
  private readonly emitCandidate: DetectorOptions["onCandidate"];
  private readonly logger: typeof log;
  private running = false;
  private loopPromise: Promise<void> | null = null;
  private readonly cmdlineCache = new Map<number, CmdlineCacheEntry>();
  private readonly notifiedPorts = new Map<number, NotifiedEntry>();

  constructor(options: DetectorOptions) {
    this.pollInterval = Math.max(
      1_000,
      options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
    );
    this.workerId = options.workerId;
    this.emitCandidate = options.onCandidate;
    this.logger = options.logger ?? log;
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.loopPromise = this.pollLoop();
  }

  async stop(): Promise<void> {
    this.running = false;
    const loop = this.loopPromise;
    if (loop) {
      try {
        await loop;
      } catch {
        // Ignore loop rejection during shutdown
      }
    }
  }

  private async pollLoop(): Promise<void> {
    while (this.running) {
      try {
        await this.pollOnce();
      } catch (error) {
        this.logger(
          "ERROR",
          "[DevServerDetector] Failed to poll listening ports",
          error instanceof Error ? { message: error.message } : error,
          this.workerId,
        );
      }
      await delay(this.pollInterval);
    }
  }

  private async pollOnce(): Promise<void> {
    const listening = await listListeningPorts();
    const now = Date.now();

    for (const entry of listening) {
      if (RESERVED_CMUX_PORT_SET.has(entry.port)) {
        continue;
      }

      const prior = this.notifiedPorts.get(entry.port);
      if (prior && prior.pid === entry.pid) {
        continue;
      }
      if (prior && now - prior.notifiedAt < RESURFACE_INTERVAL_MS) {
        continue;
      }

      const cmdline = await this.readCmdline(entry.pid);
      const candidate = {
        port: entry.port,
        pid: entry.pid,
        processName: entry.processName,
        cmdline,
      } satisfies DevServerProcessInfo;

      if (!isLikelyDevServerCandidate(candidate)) {
        continue;
      }

      try {
        await this.emitCandidate(candidate);
        this.notifiedPorts.set(entry.port, {
          pid: entry.pid,
          notifiedAt: now,
        });
      } catch (error) {
        this.logger(
          "ERROR",
          "[DevServerDetector] onCandidate handler failed",
          error instanceof Error ? { message: error.message } : error,
          this.workerId,
        );
      }
    }
  }

  private async readCmdline(pid: number): Promise<string | null> {
    const cached = this.cmdlineCache.get(pid);
    const now = Date.now();
    if (cached && now - cached.capturedAt < CMDLINE_CACHE_TTL_MS) {
      return cached.cmdline;
    }

    try {
      const raw = await fs.readFile(`/proc/${pid}/cmdline`, "utf8");
      const cleaned = raw.replace(/\u0000/g, " ").trim();
      const value = cleaned.length > 0 ? cleaned : null;
      this.storeCmdline(pid, value, now);
      return value;
    } catch (error) {
      this.storeCmdline(pid, null, now);
      const errno = (error as { code?: string }).code;
      if (errno && ["ENOENT", "EACCES", "EPERM"].includes(errno)) {
        return null;
      }
      throw error;
    }
  }

  private storeCmdline(pid: number, cmdline: string | null, capturedAt: number) {
    this.cmdlineCache.set(pid, { cmdline, capturedAt });
    if (this.cmdlineCache.size <= CMDLINE_CACHE_MAX_SIZE) {
      return;
    }
    let oldestEntry: [number, CmdlineCacheEntry] | undefined;
    for (const entry of this.cmdlineCache.entries()) {
      if (!oldestEntry || entry[1].capturedAt < oldestEntry[1].capturedAt) {
        oldestEntry = entry;
      }
    }
    if (oldestEntry) {
      this.cmdlineCache.delete(oldestEntry[0]);
    }
  }
}

interface ListeningPortEntry {
  port: number;
  pid: number;
  processName: string;
}

async function listListeningPorts(): Promise<ListeningPortEntry[]> {
  const result: ListeningPortEntry[] = [];
  try {
    const { stdout } = await execFileAsync("ss", ["-Hltpn"]);
    const lines = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const seen = new Set<string>();

    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length < 5) {
        continue;
      }

      const localAddress = parts[3];
      if (!localAddress) {
        continue;
      }
      const port = parsePortFromAddress(localAddress);
      if (!port) {
        continue;
      }

      const processMatch = line.match(/users:\(\("([^"()]+)",pid=(\d+)/);
      if (!processMatch) {
        continue;
      }
      const processName = processMatch[1];
      const pidStr = processMatch[2];
      if (!processName || !pidStr) {
        continue;
      }
      const pid = parseInt(pidStr, 10);
      if (!Number.isFinite(pid)) {
        continue;
      }

      const key = `${port}:${pid}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      result.push({ port, pid, processName });
    }
  } catch (error) {
    log(
      "ERROR",
      "[DevServerDetector] Failed to invoke ss",
      error instanceof Error ? { message: error.message } : error,
    );
  }
  return result;
}

function parsePortFromAddress(address: string): number | null {
  if (!address) {
    return null;
  }
  const idx = address.lastIndexOf(":");
  if (idx === -1) {
    return null;
  }
  const portStr = address.slice(idx + 1);
  const port = Number.parseInt(portStr, 10);
  if (!Number.isFinite(port) || port <= 0) {
    return null;
  }
  return port;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms).unref?.();
  });
}
