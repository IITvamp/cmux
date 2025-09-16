import { createHash } from "node:crypto";
import { existsSync, promises as fs } from "node:fs";
import { extname, join, resolve } from "node:path";

import { app, clipboard, ipcMain } from "electron";

import { MAX_LOG_CONTENT_BYTES } from "../../shared/log-constants";
import type {
  ElectronLogFile,
  ElectronLogSource,
} from "../../src/types/electron-logs";

const LOG_EXTENSIONS = new Set([".log", ".txt"]);
const FATAL_PREFIX = "fatal-";

interface Logger {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

function hashForId(source: ElectronLogSource, fullPath: string): string {
  return createHash("sha1").update(`${source}:${fullPath}`).digest("hex");
}

async function readFileWithLimit(
  fullPath: string,
  size: number
): Promise<{ content: string; truncated: boolean }> {
  if (size <= MAX_LOG_CONTENT_BYTES) {
    const content = await fs.readFile(fullPath, { encoding: "utf8" });
    return { content, truncated: false };
  }

  const start = Math.max(0, size - MAX_LOG_CONTENT_BYTES);
  const handle = await fs.open(fullPath, "r");
  try {
    const buffer = Buffer.allocUnsafe(MAX_LOG_CONTENT_BYTES);
    const { bytesRead } = await handle.read(
      buffer,
      0,
      MAX_LOG_CONTENT_BYTES,
      start
    );
    const body = buffer.toString("utf8", 0, bytesRead);
    const notice = `… showing last ${MAX_LOG_CONTENT_BYTES} bytes of ${size} …\n`;
    return { content: `${notice}${body}`, truncated: true };
  } finally {
    await handle.close();
  }
}

async function collectFromDirectory(
  directory: string,
  source: ElectronLogSource,
  logger: Logger,
  filter?: (fileName: string) => boolean
): Promise<ElectronLogFile[]> {
  const logs: ElectronLogFile[] = [];
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const name = entry.name;
      if (filter && !filter(name)) continue;
      const ext = extname(name).toLowerCase();
      if (!filter && !LOG_EXTENSIONS.has(ext)) continue;
      const fullPath = join(directory, name);
      try {
        const stats = await fs.stat(fullPath);
        const { content, truncated } = await readFileWithLimit(
          fullPath,
          stats.size
        );
        logs.push({
          id: hashForId(source, fullPath),
          name,
          fullPath,
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
          source,
          truncated,
          content,
        });
      } catch (error) {
        logger.warn("Failed to read log file", { fullPath, error });
      }
    }
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code !== "ENOENT") {
      logger.warn("Failed to read logs directory", { directory, error });
    }
  }
  return logs;
}

function uniqueByPath(logs: ElectronLogFile[]): ElectronLogFile[] {
  const seen = new Map<string, ElectronLogFile>();
  for (const log of logs) {
    if (!seen.has(log.fullPath)) {
      seen.set(log.fullPath, log);
    }
  }
  return Array.from(seen.values());
}

function sortByModifiedDesc(logs: ElectronLogFile[]): ElectronLogFile[] {
  return [...logs].sort((a, b) => {
    const aTime = new Date(a.modifiedAt).getTime();
    const bTime = new Date(b.modifiedAt).getTime();
    return bTime - aTime;
  });
}

async function gatherLogs(logger: Logger): Promise<ElectronLogFile[]> {
  const collected: ElectronLogFile[] = [];

  try {
    const userDataLogs = join(app.getPath("userData"), "logs");
    if (existsSync(userDataLogs)) {
      collected.push(
        ...(
          await collectFromDirectory(userDataLogs, "userData", logger)
        )
      );
    }
  } catch (error) {
    logger.warn("Unable to enumerate userData logs", { error });
  }

  try {
    const fatalDir = app.getPath("userData");
    collected.push(
      ...(await collectFromDirectory(
        fatalDir,
        "fatal",
        logger,
        (name) =>
          name.startsWith(FATAL_PREFIX) && name.toLowerCase().endsWith(".log")
      ))
    );
  } catch (error) {
    logger.warn("Unable to enumerate fatal logs", { error });
  }

  try {
    const appPath = app.getAppPath();
    const repoRoot = resolve(appPath, "../..");
    const repoLogs = join(repoRoot, "logs");
    if (existsSync(repoLogs)) {
      collected.push(
        ...(
          await collectFromDirectory(repoLogs, "repository", logger)
        )
      );
    }
  } catch (error) {
    logger.warn("Unable to enumerate repository logs", { error });
  }

  return sortByModifiedDesc(uniqueByPath(collected));
}

function formatForClipboard(logs: ElectronLogFile[]): string {
  return logs
    .map((log) => {
      const header = [
        `# ${log.name}`,
        `Path: ${log.fullPath}`,
        `Source: ${log.source}`,
        `Updated: ${log.modifiedAt}`,
        `Size: ${log.size} bytes${log.truncated ? " (truncated)" : ""}`,
      ].join("\n");
      return `${header}\n\n${log.content}`;
    })
    .join("\n\n\n");
}

export function registerLogHandlers(logger: Logger): void {
  ipcMain.handle("cmux:logs:get-all", async () => {
    const logs = await gatherLogs(logger);
    logger.log("cmux:logs:get-all", { count: logs.length });
    return logs;
  });

  ipcMain.handle("cmux:logs:copy-all", async () => {
    const logs = await gatherLogs(logger);
    const formatted = formatForClipboard(logs);
    clipboard.writeText(formatted);
    logger.log("cmux:logs:copy-all", {
      count: logs.length,
      bytes: formatted.length,
    });
    return { fileCount: logs.length, totalBytes: formatted.length };
  });
}
