import { isElectron } from "@/lib/electron";
import type {
  CopyAllLogsResult,
  ElectronLogFile,
  ElectronLogSource,
} from "@/types/electron-logs";

import { MAX_LOG_CONTENT_BYTES } from "../../shared/log-constants";

const SOURCE_LABELS: Record<ElectronLogSource, string> = {
  userData: "App data",
  repository: "Workspace",
  fatal: "Crash report",
};

function isCopyAllLogsResult(value: unknown): value is CopyAllLogsResult {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.fileCount === "number" &&
    typeof candidate.totalBytes === "number"
  );
}

export function getLogSourceLabel(source: ElectronLogSource): string {
  return SOURCE_LABELS[source] ?? "Unknown";
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

export async function fetchAllElectronLogs(): Promise<ElectronLogFile[]> {
  if (!isElectron || typeof window === "undefined") {
    throw new Error("Logs are only available in the desktop app.");
  }
  const logsApi = window.cmux?.logs;
  if (!logsApi?.getAll) {
    throw new Error("Log API is unavailable.");
  }
  const logs = await logsApi.getAll();
  if (!Array.isArray(logs)) {
    throw new Error("Unexpected response when loading logs.");
  }
  return logs;
}

export async function copyAllElectronLogs(): Promise<CopyAllLogsResult> {
  if (!isElectron || typeof window === "undefined") {
    throw new Error("Logs are only available in the desktop app.");
  }
  const logsApi = window.cmux?.logs;
  if (!logsApi?.copyAll) {
    throw new Error("Log API is unavailable.");
  }
  const result = await logsApi.copyAll();
  if (!isCopyAllLogsResult(result)) {
    throw new Error("Unexpected response when copying logs.");
  }
  return result;
}

export { MAX_LOG_CONTENT_BYTES };
