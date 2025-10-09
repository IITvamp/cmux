import { RunDiffSection } from "@/components/RunDiffSection";
import { Dropdown } from "@/components/ui/dropdown";
import { normalizeGitRef } from "@/lib/refWithOrigin";
import { gitDiffQueryOptions } from "@/queries/git-diff";
import { api } from "@cmux/convex/api";
import { useQuery as useRQ, useMutation, type DefaultError } from "@tanstack/react-query";
import { useQuery as useConvexQuery } from "convex/react";
import { ExternalLink, X, Check, Circle, Clock, AlertCircle, Loader2 } from "lucide-react";
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
  headSha?: string;
};

function WorkflowRuns({ teamSlugOrId, repoFullName, prNumber, headSha }: WorkflowRunsProps) {
  const workflowRuns = useConvexQuery(api.github_workflows.getWorkflowRunsForPr, {
    teamSlugOrId,
    repoFullName,
    prNumber,
    headSha,
    limit: 50,
  });

  const checkRuns = useConvexQuery(api.github_check_runs.getCheckRunsForPr, {
    teamSlugOrId,
    repoFullName,
    prNumber,
    headSha,
    limit: 50,
  });

  const deployments = useConvexQuery(api.github_deployments.getDeploymentsForPr, {
    teamSlugOrId,
    repoFullName,
    prNumber,
    headSha,
    limit: 50,
  });

  const commitStatuses = useConvexQuery(api.github_commit_statuses.getCommitStatusesForPr, {
    teamSlugOrId,
    repoFullName,
    prNumber,
    headSha,
    limit: 50,
  });

  const isLoading = workflowRuns === undefined || checkRuns === undefined || deployments === undefined || commitStatuses === undefined;

  // Combine all types of runs
  const allRuns = [
    ...(workflowRuns || []).map(run => ({ ...run, type: 'workflow' as const, name: run.workflowName, timestamp: run.runStartedAt })),
    ...(checkRuns || []).map(run => ({ ...run, type: 'check' as const, timestamp: run.startedAt })),
    ...(deployments || []).map(dep => ({
      ...dep,
      type: 'deployment' as const,
      name: dep.description || dep.environment || 'Deployment',
      timestamp: dep.createdAt,
      status: dep.state === 'pending' || dep.state === 'queued' || dep.state === 'in_progress' ? 'in_progress' : 'completed',
      conclusion: dep.state === 'success' ? 'success' : dep.state === 'failure' || dep.state === 'error' ? 'failure' : undefined
    })),
    ...(commitStatuses || []).map(status => ({
      ...status,
      type: 'status' as const,
      name: status.context,
      timestamp: status.updatedAt,
      status: status.state === 'pending' ? 'in_progress' : 'completed',
      conclusion: status.state === 'success' ? 'success' : status.state === 'failure' || status.state === 'error' ? 'failure' : undefined
    })),
  ];

  // Don't show anything while loading or if no runs
  if (isLoading || allRuns.length === 0) {
    return null;
  }

  // Filter out Preview deployments (they go in sidebar Preview tab instead)
  const filteredRuns = allRuns.filter(run => !(run.type === 'deployment' && run.environment === 'Preview'));

  // Deduplicate by GitHub ID
  const deduped = new Map<string, typeof filteredRuns[number]>();
  for (const run of filteredRuns) {
    let key: string;
    if (run.type === 'workflow') key = `workflow-${run.runId}`;
    else if (run.type === 'check') key = `check-${run.checkRunId}`;
    else if (run.type === 'deployment') key = `deployment-${run.deploymentId}`;
    else key = `status-${run.statusId}`;

    const existing = deduped.get(key);
    if (!existing || (run.timestamp ?? 0) > (existing.timestamp ?? 0)) {
      deduped.set(key, run);
    }
  }

  const latestRuns = Array.from(deduped.values());

  const hasAnyRunning = latestRuns.some(
    (run) => run.status === "in_progress" || run.status === "queued" || run.status === "waiting" || run.status === "pending"
  );
  const hasAnyFailure = latestRuns.some(
    (run) => run.conclusion === "failure" || run.conclusion === "timed_out" || run.conclusion === "action_required"
  );
  const allPassed = latestRuns.length > 0 && latestRuns.every(
    (run) => run.conclusion === "success" || run.conclusion === "neutral" || run.conclusion === "skipped"
  );

  let icon;
  let colorClass;
  let statusText;

  if (hasAnyRunning) {
    icon = <Clock className="w-3.5 h-3.5 animate-pulse" />;
    colorClass = "text-yellow-600 dark:text-yellow-400";
    statusText = "Running";
  } else if (hasAnyFailure) {
    icon = <X className="w-3.5 h-3.5" />;
    colorClass = "text-red-600 dark:text-red-400";
    statusText = "Failed";
  } else if (allPassed) {
    icon = <Check className="w-3.5 h-3.5" />;
    colorClass = "text-green-600 dark:text-green-400";
    statusText = "Passed";
  } else {
    icon = <Circle className="w-3.5 h-3.5" />;
    colorClass = "text-neutral-500 dark:text-neutral-400";
    statusText = "Checks";
  }

  return (
    <div className={`flex items-center gap-1.5 ml-2 shrink-0 ${colorClass}`}>
      {icon}
      <span className="text-[11px] font-medium select-none">{statusText}</span>
    </div>
  );
}

function WorkflowRunsSection({ teamSlugOrId, repoFullName, prNumber, headSha }: WorkflowRunsProps) {
  const workflowRuns = useConvexQuery(api.github_workflows.getWorkflowRunsForPr, {
    teamSlugOrId,
    repoFullName,
    prNumber,
    headSha,
    limit: 50,
  });

  const checkRuns = useConvexQuery(api.github_check_runs.getCheckRunsForPr, {
    teamSlugOrId,
    repoFullName,
    prNumber,
    headSha,
    limit: 50,
  });

  const deployments = useConvexQuery(api.github_deployments.getDeploymentsForPr, {
    teamSlugOrId,
    repoFullName,
    prNumber,
    headSha,
    limit: 50,
  });

  const commitStatuses = useConvexQuery(api.github_commit_statuses.getCommitStatusesForPr, {
    teamSlugOrId,
    repoFullName,
    prNumber,
    headSha,
    limit: 50,
  });

  // Check if any queries are still loading
  const isLoading = workflowRuns === undefined || checkRuns === undefined || deployments === undefined || commitStatuses === undefined;

  // Combine all types of runs - group Vercel deployments with their statuses
  const allRuns = [
    ...(workflowRuns || []).map(run => ({ ...run, type: 'workflow' as const, name: run.workflowName, timestamp: run.runStartedAt, url: run.htmlUrl })),
    ...(checkRuns || []).map(run => {
      const url = run.htmlUrl || `https://github.com/${repoFullName}/pull/${prNumber}/checks?check_run_id=${run.checkRunId}`;
      return { ...run, type: 'check' as const, timestamp: run.startedAt, url };
    }),
    ...(deployments || []).map(dep => ({
      ...dep,
      type: 'deployment' as const,
      name: dep.description || dep.environment || 'Deployment',
      timestamp: dep.createdAt,
      status: dep.state === 'pending' || dep.state === 'queued' || dep.state === 'in_progress' ? 'in_progress' : 'completed',
      conclusion: dep.state === 'success' ? 'success' : dep.state === 'failure' || dep.state === 'error' ? 'failure' : undefined,
      url: dep.logUrl || dep.targetUrl || dep.environmentUrl || `https://github.com/${repoFullName}/pull/${prNumber}/checks`
    })),
    ...(commitStatuses || []).map(status => ({
      ...status,
      type: 'status' as const,
      name: status.context,
      timestamp: status.updatedAt,
      status: status.state === 'pending' ? 'in_progress' : 'completed',
      conclusion: status.state === 'success' ? 'success' : status.state === 'failure' || status.state === 'error' ? 'failure' : undefined,
      url: status.targetUrl || `https://github.com/${repoFullName}/pull/${prNumber}/checks`
    })),
  ];

  console.log('[WorkflowRunsSection] All runs:', {
    workflows: workflowRuns?.length,
    checks: checkRuns?.length,
    deployments: deployments?.map(d => ({ env: d.environment, desc: d.description, state: d.state })),
    statuses: commitStatuses?.map(s => ({ context: s.context, state: s.state })),
    total: allRuns.length
  });

  const getStatusIcon = (status?: string, conclusion?: string) => {
    if (conclusion === "success") {
      return <Check className="w-4 h-4 text-green-600 dark:text-green-400" strokeWidth={2.5} />;
    }
    if (conclusion === "failure") {
      return <X className="w-4 h-4 text-red-600 dark:text-red-400" strokeWidth={2.5} />;
    }
    if (conclusion === "cancelled") {
      return <Circle className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />;
    }
    if (status === "in_progress" || status === "queued") {
      return <Loader2 className="w-4 h-4 text-yellow-600 dark:text-yellow-500 animate-spin" />;
    }
    return <AlertCircle className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />;
  };


  const formatTimeAgo = (timestamp?: number) => {
    if (!timestamp) return "";
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getStatusDescription = (run: typeof allRuns[0]) => {
    const parts: string[] = [];

    if (run.conclusion === "success") {
      if (run.type === 'workflow' && 'runDuration' in run && run.runDuration) {
        const mins = Math.floor(run.runDuration / 60);
        const secs = run.runDuration % 60;
        parts.push(`Successful in ${mins}m ${secs}s`);
      } else {
        parts.push("Successful");
      }
    } else if (run.conclusion === "failure") {
      parts.push("Failed");
    } else if (run.conclusion === "cancelled") {
      parts.push("Cancelled");
    } else if (run.conclusion === "skipped") {
      parts.push("Skipped");
    } else if (run.conclusion === "timed_out") {
      parts.push("Timed out");
    } else if (run.conclusion === "action_required") {
      parts.push("Action required");
    } else if (run.conclusion === "neutral") {
      parts.push("Neutral");
    } else if (run.status === "in_progress") {
      parts.push("In progress");
    } else if (run.status === "queued") {
      parts.push("Queued");
    } else if (run.status === "waiting") {
      parts.push("Waiting");
    } else if (run.status === "pending") {
      parts.push("Pending");
    }

    const timeAgo = formatTimeAgo(run.timestamp);
    if (timeAgo) {
      parts.push(timeAgo);
    }

    return parts.join(" — ");
  };


  // Don't show anything while loading or if no runs
  if (isLoading || allRuns.length === 0) {
    return null;
  }

  // Filter out Preview deployments (they go in sidebar Preview tab instead)
  const filteredRuns = allRuns.filter(run => !(run.type === 'deployment' && run.environment === 'Preview'));

  // Deduplicate by GitHub ID (checkRunId, runId, deploymentId, statusId) + name
  const deduped = new Map<string, typeof filteredRuns[number]>();
  for (const run of filteredRuns) {
    let key: string;
    if (run.type === 'workflow') key = `workflow-${run.runId}`;
    else if (run.type === 'check') key = `check-${run.checkRunId}`;
    else if (run.type === 'deployment') key = `deployment-${run.deploymentId}`;
    else key = `status-${run.statusId}`;

    const existing = deduped.get(key);
    if (existing) {
      console.log('[WorkflowRunsSection] Duplicate found:', { key, name: run.name, existingTime: existing.timestamp, newTime: run.timestamp });
    }
    if (!existing || (run.timestamp ?? 0) > (existing.timestamp ?? 0)) {
      deduped.set(key, run);
    }
  }

  console.log('[WorkflowRunsSection] After dedup:', {
    before: filteredRuns.length,
    after: deduped.size,
    names: Array.from(deduped.values()).map(r => r.name)
  });

  const sortedRuns = Array.from(deduped.values()).sort((a, b) => {
    return (b.timestamp ?? 0) - (a.timestamp ?? 0);
  });

  return (
    <div className="border-t border-b border-neutral-200 dark:border-neutral-800">
      <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {sortedRuns.map((run) => (
          <a
            key={`${run.type}-${run._id}`}
            href={run.url || '#'}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors group"
          >
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="shrink-0">
                {getStatusIcon(run.status, run.conclusion)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-neutral-900 dark:text-neutral-100">
                  {run.name}
                </div>
              </div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400 shrink-0">
                {getStatusDescription(run)}
              </div>
            </div>
            {run.url && (
              <div className="p-1 shrink-0">
                <ExternalLink className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
              </div>
            )}
          </a>
        ))}
      </div>
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
                    headSha={currentPR.headSha}
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
                      isLoading={mergePrMutation.isPending}
                    />
                    <button
                      onClick={handleClosePR}
                      disabled={mergePrMutation.isPending || closePrMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1 h-[26px] bg-[#cf222e] dark:bg-[#da3633] text-white rounded hover:bg-[#cf222e]/90 dark:hover:bg-[#da3633]/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs select-none whitespace-nowrap transition-colors"
                    >
                      {closePrMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <X className="w-3.5 h-3.5" />
                      )}
                      {closePrMutation.isPending ? "Closing..." : "Close PR"}
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
                headSha={currentPR.headSha}
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
