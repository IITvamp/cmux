import { diffRefsQueryOptions } from "@/queries/diff-refs";
import { diffLandedQueryOptions } from "@/queries/diff-landed";
import { useQuery as useRQ } from "@tanstack/react-query";
import { type ComponentProps } from "react";
import { GitDiffViewer } from "./git-diff-viewer";

export interface RunDiffSectionProps {
  repoFullName: string;
  ref1: string;
  ref2: string;
  viewMode?: "latest" | "landed";
  classNames?: ComponentProps<typeof GitDiffViewer>["classNames"];
  onControlsChange?: ComponentProps<typeof GitDiffViewer>["onControlsChange"];
}

export function RunDiffSection(props: RunDiffSectionProps) {
  const { repoFullName, ref1, ref2, viewMode = "latest", classNames, onControlsChange } = props;

  const latestQuery = useRQ(diffRefsQueryOptions({ repoFullName, ref1, ref2 }));
  const landedQuery = useRQ(
    viewMode === "landed"
      ? diffLandedQueryOptions({ repoFullName, baseRef: ref1, headRef: ref2 })
      : { queryKey: ["diff-landed-disabled"], queryFn: async () => [] }
  );
  const diffsQuery = viewMode === "landed" ? landedQuery : latestQuery;

  // Debugging aid for user: log active mode and results
  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.debug("[RunDiffSection]", { repoFullName, ref1, ref2, viewMode, latestLen: latestQuery.data?.length, landedLen: landedQuery.data?.length });
  }

  // No workspace watcher in refs mode

  if (diffsQuery.isPending) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-neutral-500 dark:text-neutral-400 text-sm select-none">
          Loading diffs...
        </div>
      </div>
    );
  }

  if (!diffsQuery.isSuccess) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500 dark:text-red-400 text-sm select-none">
          Failed to load diffs.
          <pre>{JSON.stringify(diffsQuery.error)}</pre>
        </div>
      </div>
    );
  }

  if (diffsQuery.data.length === 0) {
    <div className="flex items-center justify-center h-full">
      <div className="text-neutral-500 dark:text-neutral-400 text-sm select-none">
        No changes to display
      </div>
    </div>;
  }

  return (
    <GitDiffViewer
      key={`${repoFullName}:${ref1}:${ref2}`}
      diffs={diffsQuery.data}
      onControlsChange={onControlsChange}
      classNames={classNames}
    />
  );
}
