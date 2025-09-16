import { Button } from "@/components/ui/button";
import type { ElectronLogFile } from "@/types/electron-logs";
import {
  ClipboardCopy,
  Loader2,
  RefreshCcw,
  ScrollText,
} from "lucide-react";

import { LogFileCard } from "./LogFileCard";

interface LogsViewProps {
  logs: ElectronLogFile[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  onRefresh: () => void;
  onCopyAll: () => void;
  copying: boolean;
}

export function LogsView({
  logs,
  loading,
  error,
  lastUpdated,
  onRefresh,
  onCopyAll,
  copying,
}: LogsViewProps) {
  const hasLogs = logs.length > 0;
  const lastUpdatedText = lastUpdated
    ? lastUpdated.toLocaleString()
    : "Never";
  const lastUpdatedIso = lastUpdated ? lastUpdated.toISOString() : undefined;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-neutral-900 p-3 text-white dark:bg-neutral-100 dark:text-neutral-900">
            <ScrollText className="h-6 w-6" aria-hidden />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
              Application logs
            </h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              Review logs from the main process, renderer, and filesystem.
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Last updated:{" "}
              {lastUpdatedIso ? (
                <time dateTime={lastUpdatedIso}>{lastUpdatedText}</time>
              ) : (
                <span>{lastUpdatedText}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => onRefresh()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCcw className="h-4 w-4" aria-hidden />
            )}
            Refresh
          </Button>
          <Button onClick={() => onCopyAll()} disabled={copying}>
            {copying ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <ClipboardCopy className="h-4 w-4" aria-hidden />
            )}
            Copy all
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive dark:border-destructive/40 dark:bg-destructive/20">
          {error}
        </div>
      ) : null}

      {loading && !hasLogs ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-neutral-200 bg-white p-10 text-center text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          <span>Loading logs…</span>
        </div>
      ) : null}

      {!loading && !hasLogs ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          No logs found yet. Run a task or interact with the app to generate log entries.
        </div>
      ) : null}

      {hasLogs ? (
        <div className="flex flex-col gap-6">
          {logs.map((log) => (
            <LogFileCard key={log.id} log={log} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
