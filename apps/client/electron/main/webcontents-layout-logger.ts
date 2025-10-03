import path from "node:path";
import { app } from "electron";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  type WriteStream,
} from "node:fs";

import type {
  WebContentsLayoutActualState,
  WebContentsLayoutLogRequest,
} from "../../src/types/webcontents-debug";

type Logger = {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
};

interface LayoutLogEntry {
  request: WebContentsLayoutLogRequest;
  actual: WebContentsLayoutActualState | null;
  error?: string;
}

let layoutLogStream: WriteStream | null = null;
let layoutLogPath: string | null = null;
let storedLogger: Logger | null = null;

function resolveLogsDirectory(): string {
  const appPath = app.getAppPath();
  try {
    const maybeRoot = path.resolve(appPath, "../..");
    const repoLogs = path.join(maybeRoot, "logs");
    if (!existsSync(repoLogs)) {
      mkdirSync(repoLogs, { recursive: true });
    }
    return repoLogs;
  } catch {
    const fallback = path.join(app.getPath("userData"), "logs");
    if (!existsSync(fallback)) {
      mkdirSync(fallback, { recursive: true });
    }
    return fallback;
  }
}

function ensureLayoutLogStream(): void {
  if (layoutLogStream) return;
  const logger = storedLogger;
  try {
    const directory = resolveLogsDirectory();
    const file = path.join(directory, "webcontents-layout.log");
    layoutLogStream = createWriteStream(file, { flags: "a", encoding: "utf8" });
    layoutLogPath = file;
    logger?.log?.("WebContents layout log path:", file);
  } catch (error) {
    layoutLogStream = null;
    layoutLogPath = null;
    logger?.warn?.("Failed to initialize WebContents layout log file", error);
  }
}

export function initWebContentsLayoutLogger(logger: Logger): void {
  storedLogger = logger;
  ensureLayoutLogStream();
}

export function appendWebContentsLayoutLogEntry(entry: LayoutLogEntry): void {
  if (!layoutLogStream) {
    ensureLayoutLogStream();
  }
  if (!layoutLogStream) {
    storedLogger?.warn?.("WebContents layout logger unavailable; dropping entry");
    return;
  }

  const line = {
    ts: new Date().toISOString(),
    path: layoutLogPath,
    request: entry.request,
    actual: entry.actual,
    error: entry.error ?? null,
  };

  try {
    layoutLogStream.write(`${JSON.stringify(line)}\n`);
  } catch (error) {
    storedLogger?.warn?.("Failed to write WebContents layout entry", error);
  }
}
