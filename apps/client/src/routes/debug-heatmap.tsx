import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { ReplaceDiffEntry } from "@cmux/shared/diff-types";

import { MonacoGitDiffViewer } from "@/components/monaco/monaco-git-diff-viewer";
import { debugMonacoDiffSamples } from "@/lib/debug-monaco-samples";
import { debugHeatmapHighlights } from "@/lib/debug-heatmap-samples";
import { computeDiffStats } from "@/lib/monaco-diff-stats";

export const Route = createFileRoute("/debug-heatmap")({
  component: DebugHeatmapPage,
});

function DebugHeatmapPage() {
  const diffs = useMemo<ReplaceDiffEntry[]>(
    () =>
      debugMonacoDiffSamples.map((sample) => {
        const { additions, deletions } = computeDiffStats(
          sample.original,
          sample.modified,
        );

        return {
          filePath: sample.filePath,
          status: "modified",
          additions,
          deletions,
          oldContent: sample.original,
          newContent: sample.modified,
          patch: undefined,
          oldPath: undefined,
          isBinary: false,
          contentOmitted: false,
        } satisfies ReplaceDiffEntry;
      }),
    [],
  );

  const sampleDataPreview = useMemo(
    () => JSON.stringify(debugHeatmapHighlights, null, 2),
    [],
  );

  return (
    <div className="min-h-dvh bg-neutral-100 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="m-1 h-[calc(100dvh-8px)] overflow-auto rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="space-y-4 p-4 sm:p-6">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300">
            <p className="font-medium text-neutral-900 dark:text-neutral-100">
              Monaco heatmap proof of concept
            </p>
            <p className="mt-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
              Each line receives a review score and optional rationale. We convert
              the sample structure into Monaco decorations so reviewers can spot
              the riskiest tokens at a glance.
            </p>
            <pre className="mt-3 max-h-48 overflow-auto rounded-md bg-neutral-900/5 p-3 text-[11px] leading-relaxed text-neutral-700 dark:bg-neutral-950/40 dark:text-neutral-200">
              {sampleDataPreview}
            </pre>
          </div>

          <MonacoGitDiffViewer diffs={diffs} heatmap={debugHeatmapHighlights} />
        </div>
      </div>
    </div>
  );
}
