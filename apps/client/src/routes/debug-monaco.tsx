import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { ReplaceDiffEntry } from "@cmux/shared/diff-types";

import { MonacoGitDiffViewer } from "@/components/monaco/monaco-git-diff-viewer";
import { buildDebugDiffEntries } from "@/lib/debug-diff-utils";
import { debugMonacoDiffSamples } from "@/lib/debug-monaco-samples";

export const Route = createFileRoute("/debug-monaco")({
  component: DebugMonacoPage,
});

function DebugMonacoPage() {
  const diffs = useMemo<ReplaceDiffEntry[]>(
    () => buildDebugDiffEntries(debugMonacoDiffSamples),
    [],
  );

  return (
    <div className="min-h-dvh bg-neutral-100 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="m-1 h-[calc(100dvh-8px)] overflow-auto rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="space-y-4 p-4 sm:p-6">
          <MonacoGitDiffViewer diffs={diffs} />
        </div>
      </div>
    </div>
  );
}
