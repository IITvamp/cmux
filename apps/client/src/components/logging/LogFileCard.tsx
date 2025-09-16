import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  MAX_LOG_CONTENT_BYTES,
  formatFileSize,
  getLogSourceLabel,
} from "@/lib/logs";
import type { ElectronLogFile } from "@/types/electron-logs";
import { FileText } from "lucide-react";

interface LogFileCardProps {
  log: ElectronLogFile;
}

export function LogFileCard({ log }: LogFileCardProps) {
  const hasContent = log.content.trim().length > 0;
  const displayContent = hasContent ? log.content : "(No log entries)";
  const truncatedLabel = `Showing last ${formatFileSize(
    MAX_LOG_CONTENT_BYTES
  )} of ${formatFileSize(log.size)}`;
  const updatedDate = new Date(log.modifiedAt);
  const hasValidDate = !Number.isNaN(updatedDate.getTime());
  const updatedDisplay = hasValidDate
    ? updatedDate.toLocaleString()
    : "Unknown time";
  const updatedIso = hasValidDate ? updatedDate.toISOString() : undefined;

  return (
    <Card className="border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <CardHeader className="flex flex-col gap-4 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-neutral-100 p-2 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300">
            <FileText className="h-5 w-5" aria-hidden />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {log.name}
            </CardTitle>
            <CardDescription className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {getLogSourceLabel(log.source)}
              </span>
              {hasValidDate ? (
                <time dateTime={updatedIso}>
                  Updated {updatedDisplay}
                </time>
              ) : (
                <span>Updated {updatedDisplay}</span>
              )}
              <span>{formatFileSize(log.size)}</span>
            </CardDescription>
          </div>
        </div>
        {log.truncated ? (
          <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:border-amber-500/70 dark:bg-amber-500/10 dark:text-amber-300">
            {truncatedLabel}
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="text-xs text-neutral-500 dark:text-neutral-400">
          <span className="font-medium text-neutral-700 dark:text-neutral-200">Path:</span>{" "}
          <code className="break-all text-neutral-700 dark:text-neutral-200">
            {log.fullPath}
          </code>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50">
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words p-4 text-xs font-mono leading-relaxed text-neutral-800 dark:text-neutral-100">
            {displayContent}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
