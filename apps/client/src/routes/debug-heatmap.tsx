import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { ReplaceDiffEntry } from "@cmux/shared/diff-types";

import { MonacoGitDiffViewer } from "@/components/monaco/monaco-git-diff-viewer";
import { buildDebugDiffEntries } from "@/lib/debug-diff-utils";
import {
  debugHeatmapDiffSamples,
  debugHeatmapHighlights,
} from "@/lib/debug-heatmap-samples";

export const Route = createFileRoute("/debug-heatmap")({
  component: DebugHeatmapPage,
});

function DebugHeatmapPage() {
  const diffs = useMemo<ReplaceDiffEntry[]>(
    () => buildDebugDiffEntries(debugHeatmapDiffSamples),
    [],
  );

  const heatmap = useMemo(() => debugHeatmapHighlights, []);

  return (
    <div className="min-h-dvh bg-neutral-100 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="m-1 h-[calc(100dvh-8px)] overflow-auto rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="space-y-4 p-4 sm:p-6">
          <div className="space-y-2">
            <h1 className="text-lg font-semibold">Monaco Diff Heatmap</h1>
            <p className="max-w-2xl text-sm text-neutral-600 dark:text-neutral-300">
              This debug view highlights suspicious regions of the diff by applying Monaco
              decorations. Each line uses a score-based color ramp and optional hover
              context that explains why the reviewer should take a closer look.
            </p>
          </div>

          <MonacoGitDiffViewer diffs={diffs} heatmap={heatmap} />
        </div>
      </div>
    </div>
  );
}
