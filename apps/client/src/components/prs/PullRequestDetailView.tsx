import { RunDiffSection } from "@/components/RunDiffSection";
import { Dropdown } from "@/components/ui/dropdown";
import { normalizeGitRef } from "@/lib/refWithOrigin";
import { gitDiffQueryOptions } from "@/queries/git-diff";
import { api } from "@cmux/convex/api";
import { useQuery as useRQ, useMutation, type DefaultError } from "@tanstack/react-query";
import { useQuery as useConvexQuery } from "convex/react";
import { ExternalLink, X, Check, Circle, Clock, AlertCircle, GitCommit } from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import { toast } from "sonner";
import { MergeButton, type MergeMethod } from "@/components/ui/merge-button";
import { postApiIntegrationsGithubPrsCloseMutation } from "@cmux/www-openapi-client/react-query";
import { postApiIntegrationsGithubPrsMergeSimple } from "@cmux/www-openapi-client";
import type {
  Options,
  PostApiIntegrationsGithubPrsCloseData,
  PostApiIntegrationsGithubPrsCloseResponse,
  PostApiIntegrationsGithubPrsMergeSimpleResponse,
} from "@cmux/www-openapi-client";

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

type WorkflowRunsProps = {
  teamSlugOrId: string;
  repoFullName: string;
  prNumber: number;
};

function WorkflowRuns({ teamSlugOrId, repoFullName, prNumber }: WorkflowRunsProps) {
  const runs = useConvexQuery(api.github_workflows.getWorkflowRunsForPr, {
    teamSlugOrId,
    repoFullName,
    prNumber,
    limit: 10,
  });

  if (!runs || runs.length === 0) {
    return (
      <div className="flex items-center gap-2 ml-2 shrink-0">
        <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
          No workflow runs
        </span>
      </div>
    );
  }

  const getStatusIcon = (status?: string, conclusion?: string) => {
    if (conclusion === "success") {
      return <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />;
    }
    if (conclusion === "failure") {
      return <X className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />;
    }
    if (conclusion === "cancelled") {
      return <Circle className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />;
    }
    if (status === "in_progress" || status === "queued") {
      return <Clock className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400 animate-pulse" />;
    }
    return <AlertCircle className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />;
  };

  const getStatusColor = (status?: string, conclusion?: string) => {
    if (conclusion === "success") {
      return "text-green-600 dark:text-green-400";
    }
    if (conclusion === "failure") {
      return "text-red-600 dark:text-red-400";
    }
    if (conclusion === "cancelled") {
      return "text-neutral-500 dark:text-neutral-400";
    }
    if (status === "in_progress" || status === "queued") {
      return "text-yellow-600 dark:text-yellow-400";
    }
    return "text-neutral-500 dark:text-neutral-400";
  };

  return (
    <div className="flex items-center gap-2 ml-2 shrink-0">
      {runs.slice(0, 3).map((run) => (
        <a
          key={run._id}
          href={run.htmlUrl}
          target="_blank"
          rel="noreferrer"
          className={`flex items-center gap-1 text-[11px] hover:underline ${getStatusColor(run.status, run.conclusion)}`}
          title={`${run.workflowName}: ${run.conclusion || run.status || 'unknown'}`}
        >
          {getStatusIcon(run.status, run.conclusion)}
          <span className="font-medium">{run.workflowName}</span>
        </a>
      ))}
      {runs.length > 3 && (
        <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
          +{runs.length - 3} more
        </span>
      )}
    </div>
  );
}

function AdditionsAndDeletions({
  repoFullName,
  ref1,
  ref2,
}: AdditionsAndDeletionsProps) {
  const diffsQuery = useRQ(
    gitDiffQueryOptions({
      repoFullName,
      baseRef: normalizeGitRef(ref1),
      headRef: normalizeGitRef(ref2),
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

function WorkflowRunsSection({ teamSlugOrId, repoFullName, prNumber }: WorkflowRunsProps) {
  const runs = useConvexQuery(api.github_workflows.getWorkflowRunsForPr, {
    teamSlugOrId,
    repoFullName,
    prNumber,
    limit: 50,
  });

  const getStatusIcon = (status?: string, conclusion?: string) => {
    if (conclusion === "success") {
      return <Check className="w-4 h-4 text-green-600 dark:text-green-400" />;
    }
    if (conclusion === "failure") {
      return <X className="w-4 h-4 text-red-600 dark:text-red-400" />;
    }
    if (conclusion === "cancelled") {
      return <Circle className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />;
    }
    if (status === "in_progress" || status === "queued") {
      return <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400 animate-pulse" />;
    }
    return <AlertCircle className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />;
  };

  const getStatusColor = (status?: string, conclusion?: string) => {
    if (conclusion === "success") {
      return "border-green-200 dark:border-green-900/40 bg-green-50 dark:bg-green-950/20";
    }
    if (conclusion === "failure") {
      return "border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20";
    }
    if (conclusion === "cancelled") {
      return "border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/20";
    }
    if (status === "in_progress" || status === "queued") {
      return "border-yellow-200 dark:border-yellow-900/40 bg-yellow-50 dark:bg-yellow-950/20";
    }
    return "border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/20";
  };

  const getStatusText = (status?: string, conclusion?: string) => {
    if (conclusion === "success") return "Passed";
    if (conclusion === "failure") return "Failed";
    if (conclusion === "cancelled") return "Cancelled";
    if (conclusion === "skipped") return "Skipped";
    if (conclusion === "timed_out") return "Timed out";
    if (conclusion === "action_required") return "Action required";
    if (conclusion === "neutral") return "Neutral";
    if (status === "in_progress") return "Running";
    if (status === "queued") return "Queued";
    if (status === "waiting") return "Waiting";
    if (status === "pending") return "Pending";
    return "Unknown";
  };

  const formatEventType = (event?: string) => {
    if (!event) return null;
    return event.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (!runs || runs.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {runs.map((run) => (
          <a
            key={run._id}
            href={run.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className={`flex items-start gap-3 px-3.5 py-3 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors border-l-2 ${getStatusColor(run.status, run.conclusion)}`}
          >
            <div className="mt-0.5">
              {getStatusIcon(run.status, run.conclusion)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                  {run.workflowName}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium shrink-0">
                  {getStatusText(run.status, run.conclusion)}
                </span>
              </div>
              {run.name && run.name !== run.workflowName && (
                <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate mb-1">
                  {run.name}
                </div>
              )}
              <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap">
                {run.runNumber && (
                  <div className="flex items-center gap-1">
                    <span>#{run.runNumber}</span>
                  </div>
                )}
                {run.event && (
                  <div className="flex items-center gap-1">
                    <span className="font-mono">{formatEventType(run.event)}</span>
                  </div>
                )}
                {run.headSha && (
                  <div className="flex items-center gap-1">
                    <GitCommit className="w-3 h-3" />
                    <span className="font-mono">{run.headSha.substring(0, 7)}</span>
                  </div>
                )}
                {run.headBranch && (
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-neutral-600 dark:text-neutral-400">{run.headBranch}</span>
                  </div>
                )}
                {run.actorLogin && (
                  <span>by {run.actorLogin}</span>
                )}
                {run.runStartedAt && (
                  <span>{formatTimestamp(run.runStartedAt)}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 shrink-0 mt-0.5">
              {run.runDuration ? (
                <span className="font-mono">
                  {Math.floor(run.runDuration / 60)}m {run.runDuration % 60}s
                </span>
              ) : null}
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </a>
        ))}
      </div>
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

  const [diffControls, setDiffControls] = useState<DiffControls | null>(null);

  const closePrMutation = useMutation<
    PostApiIntegrationsGithubPrsCloseResponse,
    DefaultError,
    Options<PostApiIntegrationsGithubPrsCloseData>
  >({
    ...postApiIntegrationsGithubPrsCloseMutation(),
    onSuccess: (data) => {
      toast.success(data.message || `PR #${currentPR?.number} closed successfully`);
    },
    onError: (error) => {
      toast.error(`Failed to close PR: ${error instanceof Error ? error.message : String(error)}`);
    },
  });

  const mergePrMutation = useMutation<
    PostApiIntegrationsGithubPrsMergeSimpleResponse,
    DefaultError,
    MergeMethod
  >({
    mutationFn: async (method: MergeMethod) => {
      if (!currentPR) throw new Error("No PR selected");

      const { data } = await postApiIntegrationsGithubPrsMergeSimple({
        body: {
          teamSlugOrId,
          owner,
          repo,
          number: currentPR.number,
          method,
        },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || `PR #${currentPR?.number} merged successfully`);
    },
    onError: (error) => {
      toast.error(`Failed to merge PR: ${error instanceof Error ? error.message : String(error)}`);
    },
  });

  const handleClosePR = () => {
    if (!currentPR) return;
    closePrMutation.mutate({
      body: {
        teamSlugOrId,
        owner,
        repo,
        number: currentPR.number,
      },
    });
  };

  const handleMergePR = (method: MergeMethod) => {
    mergePrMutation.mutate(method);
  };

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
                <Suspense fallback={null}>
                  <WorkflowRuns
                    teamSlugOrId={teamSlugOrId}
                    repoFullName={currentPR.repoFullName}
                    prNumber={currentPR.number}
                  />
                </Suspense>
              </div>

              <div className="col-start-3 row-start-1 row-span-2 self-center flex items-center gap-2 shrink-0">
                {/* {currentPR.draft ? (
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
                )} */}
                {currentPR.state === "open" && !currentPR.merged && (
                  <>
                    <MergeButton
                      onMerge={handleMergePR}
                      isOpen={true}
                      disabled={mergePrMutation.isPending || closePrMutation.isPending}
                    />
                    <button
                      onClick={handleClosePR}
                      disabled={mergePrMutation.isPending || closePrMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1 h-[26px] bg-[#cf222e] dark:bg-[#da3633] text-white rounded hover:bg-[#cf222e]/90 dark:hover:bg-[#da3633]/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs select-none whitespace-nowrap transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      Close PR
                    </button>
                  </>
                )}
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
            <Suspense fallback={null}>
              <WorkflowRunsSection
                teamSlugOrId={teamSlugOrId}
                repoFullName={currentPR.repoFullName}
                prNumber={currentPR.number}
              />
            </Suspense>
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
                  ref1={normalizeGitRef(currentPR.baseRef)}
                  ref2={normalizeGitRef(currentPR.headRef)}
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
