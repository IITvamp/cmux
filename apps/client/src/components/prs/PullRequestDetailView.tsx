import { RunDiffSection } from "@/components/RunDiffSection";
import { Dropdown } from "@/components/ui/dropdown";
import { MergeButton, type MergeMethod } from "@/components/ui/merge-button";
import { useSocketSuspense } from "@/contexts/socket/use-socket";
import { refWithOrigin } from "@/lib/refWithOrigin";
import { diffSmartQueryOptions } from "@/queries/diff-smart";
import { api } from "@cmux/convex/api";
import { useQuery as useRQ } from "@tanstack/react-query";
import { useQuery as useConvexQuery } from "convex/react";
import { ExternalLink } from "lucide-react";
import { Suspense, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

type PullRequestDetailViewProps = {
  teamSlugOrId: string;
  owner: string;
  repo: string;
  number: string;
};

type DiffControls = {
  expandAll: () => void;
  collapseAll: () => void;
  totalAdditions: number;
  totalDeletions: number;
};

type AdditionsAndDeletionsProps = {
  repoFullName: string;
  ref1: string;
  ref2: string;
};

function AdditionsAndDeletions({
  repoFullName,
  ref1,
  ref2,
}: AdditionsAndDeletionsProps) {
  const diffsQuery = useRQ(
    diffSmartQueryOptions({
      repoFullName,
      baseRef: refWithOrigin(ref1),
      headRef: refWithOrigin(ref2),
    })
  );

  const totals = diffsQuery.data
    ? diffsQuery.data.reduce(
        (acc, d) => {
          acc.add += d.additions || 0;
          acc.del += d.deletions || 0;
          return acc;
        },
        { add: 0, del: 0 }
      )
    : undefined;

  return (
    <div className="flex items-center gap-2 text-[11px] ml-2 shrink-0">
      {diffsQuery.isPending ? (
        <>
          <span className="inline-block rounded bg-neutral-200 dark:bg-neutral-800 min-w-[20px] h-[14px] animate-pulse" />
          <span className="inline-block rounded bg-neutral-200 dark:bg-neutral-800 min-w-[20px] h-[14px] animate-pulse" />
        </>
      ) : totals ? (
        <>
          <span className="text-green-600 dark:text-green-400 font-medium select-none">
            +{totals.add}
          </span>
          <span className="text-red-600 dark:text-red-400 font-medium select-none">
            -{totals.del}
          </span>
        </>
      ) : null}
    </div>
  );
}

export function PullRequestDetailView({
  teamSlugOrId,
  owner,
  repo,
  number,
}: PullRequestDetailViewProps) {
  const prs = useConvexQuery(api.github_prs.listPullRequests, {
    teamSlugOrId,
    state: "all",
  });
  const currentPR = useMemo(() => {
    const key = `${owner}/${repo}`;
    const num = Number(number);
    return (
      (prs || []).find((p) => p.repoFullName === key && p.number === num) ||
      null
    );
  }, [prs, owner, repo, number]);

  const linkedRun = useConvexQuery(api.taskRuns.getByPullRequestNumber, {
    teamSlugOrId,
    repoFullName: currentPR?.repoFullName ?? "",
    number: currentPR?.number ?? -1,
  });
  const { socket } = useSocketSuspense();
  const [diffControls, setDiffControls] = useState<DiffControls | null>(null);
  const [isMerging, setIsMerging] = useState(false);

  const linkedRunId = linkedRun?._id;

  const mergeDisabledReason = useMemo(() => {
    if (linkedRun === undefined) {
      return "Looking up linked task run…";
    }
    if (!linkedRun) {
      return "Merge is unavailable because this PR isn't linked to one of your runs.";
    }
    return undefined;
  }, [linkedRun]);

  const handleMerge = useCallback(
    (method: MergeMethod) => {
      if (!socket || !linkedRunId) {
        return;
      }

      setIsMerging(true);
      const toastId = toast.loading(`Merging PR (${method})...`);
      socket.emit(
        "github-merge-pr",
        { taskRunId: linkedRunId, method },
        (resp: { success: boolean; url?: string; error?: string }) => {
          setIsMerging(false);
          if (resp.success) {
            toast.success("PR merged", {
              id: toastId,
              description: resp.url,
            });
          } else {
            toast.error("Failed to merge PR", {
              id: toastId,
              description: resp.error,
            });
          }
        }
      );
    },
    [linkedRunId, socket]
  );

  if (!currentPR) {
    return (
      <div className="h-full w-full flex items-center justify-center text-neutral-500 dark:text-neutral-400">
        PR not found
      </div>
    );
  }

  const gitDiffViewerClassNames = {
    fileDiffRow: { button: "top-[56px]" },
  } as const;

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="flex-1 min-h-0">
        <div className="px-0 py-0">
          <div className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white px-3.5 sticky top-0 z-[var(--z-sticky)] py-2">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-1">
              <div className="col-start-1 row-start-1 flex items-center gap-2 relative min-w-0">
                <h1
                  className="text-sm font-bold truncate min-w-0"
                  title={currentPR.title}
                >
                  {currentPR.title}
                </h1>
                <Suspense
                  fallback={
                    <div className="flex items-center gap-2 text-[11px] ml-2 shrink-0" />
                  }
                >
                  <AdditionsAndDeletions
                    repoFullName={currentPR.repoFullName}
                    ref1={currentPR.baseRef || ""}
                    ref2={currentPR.headRef || ""}
                  />
                </Suspense>
              </div>

              <div className="col-start-3 row-start-1 row-span-2 self-center flex items-center gap-2 shrink-0">
                {currentPR.draft ? (
                  <span className="text-xs px-2 py-1 rounded-md bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 select-none">
                    Draft
                  </span>
                ) : null}
                {currentPR.merged ? (
                  <span className="text-xs px-2 py-1 rounded-md bg-purple-200 dark:bg-purple-900/40 text-purple-900 dark:text-purple-200 select-none">
                    Merged
                  </span>
                ) : currentPR.state === "closed" ? (
                  <span className="text-xs px-2 py-1 rounded-md bg-red-200 dark:bg-red-900/40 text-red-900 dark:text-red-200 select-none">
                    Closed
                  </span>
                ) : (
                  <span className="text-xs px-2 py-1 rounded-md bg-green-200 dark:bg-green-900/40 text-green-900 dark:text-green-200 select-none">
                    Open
                  </span>
                )}
                {currentPR.state === "open" && !currentPR.merged && !currentPR.draft ? (
                  <div
                    className="flex items-center"
                    title={mergeDisabledReason || undefined}
                  >
                    <MergeButton
                      onMerge={handleMerge}
                      isOpen
                      disabled={isMerging || !linkedRunId}
                    />
                  </div>
                ) : null}
                {currentPR.htmlUrl ? (
                  <a
                    className="flex items-center gap-1.5 px-3 py-1 bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-white border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-300 dark:hover:bg-neutral-700 font-medium text-xs select-none whitespace-nowrap"
                    href={currentPR.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open on GitHub
                  </a>
                ) : null}
                <Dropdown.Root>
                  <Dropdown.Trigger
                    className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white select-none"
                    aria-label="More actions"
                  >
                    ⋯
                  </Dropdown.Trigger>
                  <Dropdown.Portal>
                    <Dropdown.Positioner sideOffset={5}>
                      <Dropdown.Popup>
                        <Dropdown.Arrow />
                        <Dropdown.Item
                          onClick={() => diffControls?.expandAll?.()}
                        >
                          Expand all
                        </Dropdown.Item>
                        <Dropdown.Item
                          onClick={() => diffControls?.collapseAll?.()}
                        >
                          Collapse all
                        </Dropdown.Item>
                      </Dropdown.Popup>
                    </Dropdown.Positioner>
                  </Dropdown.Portal>
                </Dropdown.Root>
              </div>

              <div className="col-start-1 row-start-2 col-span-2 flex items-center gap-2 text-xs text-neutral-400 min-w-0">
                <span className="font-mono text-neutral-600 dark:text-neutral-300 truncate min-w-0 max-w-full select-none text-[11px]">
                  {currentPR.repoFullName}#{currentPR.number} •{" "}
                  {currentPR.authorLogin || ""}
                </span>
                <span className="text-neutral-500 dark:text-neutral-600 select-none">
                  •
                </span>
                <span className="text-[11px] text-neutral-600 dark:text-neutral-300 select-none">
                  {currentPR.headRef || "?"} → {currentPR.baseRef || "?"}
                </span>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-neutral-950">
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-full">
                  <div className="text-neutral-500 dark:text-neutral-400 text-sm select-none py-4">
                    Loading diffs...
                  </div>
                </div>
              }
            >
              {currentPR?.repoFullName &&
              currentPR.baseRef &&
              currentPR.headRef ? (
                <RunDiffSection
                  repoFullName={currentPR.repoFullName}
                  ref1={refWithOrigin(currentPR.baseRef)}
                  ref2={refWithOrigin(currentPR.headRef)}
                  onControlsChange={setDiffControls}
                  classNames={gitDiffViewerClassNames}
                />
              ) : (
                <div className="px-6 text-sm text-neutral-600 dark:text-neutral-300">
                  Missing repo or branches to show diff.
                </div>
              )}
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PullRequestDetailView;
