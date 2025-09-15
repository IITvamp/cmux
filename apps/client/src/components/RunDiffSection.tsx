import { diffSmartQueryOptions } from "@/queries/diff-smart";
import { useQuery as useRQ } from "@tanstack/react-query";
import { type ComponentProps } from "react";
import { GitDiffViewer } from "./git-diff-viewer";

export interface RunDiffSectionProps {
  repoFullName: string;
  ref1: string;
  ref2: string;
  classNames?: ComponentProps<typeof GitDiffViewer>["classNames"];
  onControlsChange?: ComponentProps<typeof GitDiffViewer>["onControlsChange"];
}

export function RunDiffSection(props: RunDiffSectionProps) {
  const { repoFullName, ref1, ref2, classNames, onControlsChange } = props;
  const diffsQuery = useRQ(
    repoFullName && ref1 && ref2
      ? diffSmartQueryOptions({ repoFullName, baseRef: ref1, headRef: ref2 })
      : { queryKey: ["diff-smart-disabled"], queryFn: async () => [] }
  );

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
