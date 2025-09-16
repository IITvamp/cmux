import { useCallback, useState } from "react";

import { MonitorPause } from "lucide-react";
import { toast } from "sonner";

import { useElectronLogs } from "@/hooks/use-electron-logs";
import { isElectron } from "@/lib/electron";
import { copyAllElectronLogs } from "@/lib/logs";

import { LogsView } from "./LogsView";

function NonElectronNotice() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 py-20 text-center sm:px-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-12 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900/90 text-white dark:bg-neutral-100 dark:text-neutral-900">
          <MonitorPause className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="mt-6 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          Logs are available in the desktop app
        </h1>
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
          Open cmux in the Electron desktop application to review consolidated logs from the main process and local filesystem.
        </p>
      </div>
    </div>
  );
}

export function LogsPage() {
  const [copying, setCopying] = useState(false);

  if (!isElectron) {
    return <NonElectronNotice />;
  }

  const { logs, loading, error, lastUpdated, refresh } = useElectronLogs();

  const handleRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  const handleCopyAll = useCallback(async () => {
    try {
      setCopying(true);
      const result = await copyAllElectronLogs();
      const plural = result.fileCount === 1 ? "log" : "logs";
      toast.success(`Copied ${result.fileCount} ${plural} to the clipboard.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error("Failed to copy logs", {
        description: message,
      });
    } finally {
      setCopying(false);
    }
  }, []);

  return (
    <LogsView
      logs={logs}
      loading={loading}
      error={error}
      lastUpdated={lastUpdated}
      onRefresh={handleRefresh}
      onCopyAll={() => {
        void handleCopyAll();
      }}
      copying={copying}
    />
  );
}
