import { FloatingPane } from "@/components/floating-pane";
import { PersistentWebView } from "@/components/persistent-webview";
import { getTaskRunPullRequestPersistKey } from "@/lib/persistent-webview-keys";
import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useEffect, useMemo, useState, Suspense } from "react";
import clsx from "clsx";
import z from "zod";
import { Check, X, Loader2, AlertCircle, ChevronRight, ChevronDown, ExternalLink } from "lucide-react";

const paramsSchema = z.object({
  taskId: typedZid("tasks"),
  runId: typedZid("taskRuns"),
});

type CombinedRun = ReturnType<typeof useCombinedWorkflowData>['allRuns'][number];

function useCombinedWorkflowData({ teamSlugOrId, repoFullName, prNumber, headSha }: {
  teamSlugOrId: string;
  repoFullName: string;
  prNumber: number;
  headSha?: string;
}) {
  const workflowRuns = useQuery(api.github_workflows.getWorkflowRunsForPr, {
    teamSlugOrId,
    repoFullName,
    prNumber,
    headSha,
    limit: 50,
  });

  const checkRuns = useQuery(api.github_check_runs.getChecksAndActionsForPr, {
    teamSlugOrId,
    repoFullName,
    prNumber,
    headSha,
    limit: 50,
  });

  const deployments = useQuery(api.github_deployments.getDeploymentsForPr, {
    teamSlugOrId,
    repoFullName,
    prNumber,
    headSha,
    limit: 50,
  });

  const commitStatuses = useQuery(api.github_commit_statuses.getCommitStatusesForPr, {
    teamSlugOrId,
    repoFullName,
    prNumber,
    headSha,
    limit: 50,
  });

  const isLoading = workflowRuns === undefined || checkRuns === undefined || deployments === undefined || commitStatuses === undefined;

  const allRuns = useMemo(() => [
    ...(workflowRuns || []).map(run => ({ ...run, type: 'workflow', name: run.workflowName, timestamp: run.runStartedAt, url: run.htmlUrl })),
    ...(checkRuns || []).map(run => {
      const url = run.htmlUrl || `https://github.com/${repoFullName}/pull/${prNumber}/checks?check_run_id=${run.checkRunId}`;
      return { ...run, type: run.type, timestamp: run.startedAt ?? run.runStartedAt, url };
    }),
    ...(deployments || []).filter(dep => dep.environment !== 'Preview').map(dep => ({
      ...dep,
      type: 'deployment',
      name: dep.description || dep.environment || 'Deployment',
      timestamp: dep.createdAt,
      status: dep.state === 'pending' || dep.state === 'queued' || dep.state === 'in_progress' ? 'in_progress' : 'completed',
      conclusion: dep.state === 'success' ? 'success' : dep.state === 'failure' || dep.state === 'error' ? 'failure' : undefined,
      url: dep.targetUrl
    })),
    ...(commitStatuses || []).map(status => ({
      ...status,
      type: 'status',
      name: status.context,
      timestamp: status.updatedAt,
      status: status.state === 'pending' ? 'in_progress' : 'completed',
      conclusion: status.state === 'success' ? 'success' : status.state === 'failure' || status.state === 'error' ? 'failure' : undefined,
      url: status.targetUrl
    })),
  ], [workflowRuns, checkRuns, deployments, commitStatuses, repoFullName, prNumber]);

  return { allRuns, isLoading };
}

function ChecksActionsSection({
  allRuns,
  isLoading,
  isExpanded,
  onToggle,
}: {
  allRuns: CombinedRun[];
  isLoading: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const sortedRuns = useMemo(() => allRuns.slice().sort((a, b) => {
    const getStatusPriority = (run: typeof a) => {
      if (run.conclusion === "failure" || run.conclusion === "timed_out" || run.conclusion === "action_required") return 0;
      if (run.status === "in_progress" || run.status === "queued" || run.status === "waiting" || run.status === "pending") return 1;
      if (run.conclusion === "success" || run.conclusion === "neutral" || run.conclusion === "skipped") return 2;
      if (run.conclusion === "cancelled") return 3;
      return 4;
    };

    const priorityA = getStatusPriority(a);
    const priorityB = getStatusPriority(b);

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    return (b.timestamp ?? 0) - (a.timestamp ?? 0);
  }), [allRuns]);

  const runningRuns = sortedRuns.filter(
    (run) => run.status === "in_progress" || run.status === "queued" || run.status === "waiting" || run.status === "pending"
  );
  const hasAnyRunning = runningRuns.length > 0;
  const failedRuns = sortedRuns.filter(
    (run) => run.conclusion === "failure" || run.conclusion === "timed_out" || run.conclusion === "action_required"
  );
  const hasAnyFailure = failedRuns.length > 0;
  const passedRuns = sortedRuns.filter(
    (run) => run.conclusion === "success" || run.conclusion === "neutral" || run.conclusion === "skipped"
  );
  const allPassed = sortedRuns.length > 0 && passedRuns.length === sortedRuns.length;

  if (isLoading) {
    return (
      <div>
        <div className="w-full flex items-center pl-3 pr-2.5 py-1.5 border-y border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
          <div className="flex items-center" style={{ width: '20px' }}>
            <div className="w-3.5 h-3.5 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
          </div>
          <div className="flex items-center" style={{ width: '20px' }}>
            <div className="w-3 h-3 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
          </div>
          <div className="h-3 w-24 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (allRuns.length === 0) {
    return null;
  }

  const { summaryIcon, summaryText, summaryColorClass } = hasAnyRunning
    ? {
      summaryIcon: <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} />,
      summaryText: (() => {
        const parts: string[] = [];
        if (passedRuns.length > 0) {
          parts.push(`${passedRuns.length} passed`);
        }
        if (failedRuns.length > 0) {
          parts.push(`${failedRuns.length} failed`);
        }
        parts.push(`${runningRuns.length} running`);
        return parts.join(", ");
      })(),
      summaryColorClass: "text-yellow-600 dark:text-yellow-500",
    }
    : hasAnyFailure
      ? {
        summaryIcon: <X className="w-3 h-3" strokeWidth={2} />,
        summaryText: `${failedRuns.length} ${failedRuns.length === 1 ? "check" : "checks"} failed`,
        summaryColorClass: "text-red-600 dark:text-red-500",
      }
      : allPassed
        ? {
          summaryIcon: <Check className="w-3 h-3" strokeWidth={2} />,
          summaryText: "All checks passed",
          summaryColorClass: "text-green-600 dark:text-green-500",
        }
        : {
          summaryIcon: <AlertCircle className="w-3 h-3" strokeWidth={2} />,
          summaryText: `${sortedRuns.length} ${sortedRuns.length === 1 ? "check" : "checks"}`,
          summaryColorClass: "text-neutral-500 dark:text-neutral-400",
        };

  const getStatusIcon = (status?: string, conclusion?: string) => {
    if (conclusion === "success") {
      return <Check className="w-3 h-3 text-green-600 dark:text-green-400" strokeWidth={2} />;
    }
    if (conclusion === "failure") {
      return <X className="w-3 h-3 text-red-600 dark:text-red-400" strokeWidth={2} />;
    }
    if (conclusion === "cancelled") {
      return <AlertCircle className="w-3 h-3 text-neutral-500 dark:text-neutral-400" strokeWidth={2} />;
    }
    if (status === "in_progress" || status === "queued") {
      return <Loader2 className="w-3 h-3 text-yellow-600 dark:text-yellow-500 animate-spin" strokeWidth={2} />;
    }
    return <AlertCircle className="w-3 h-3 text-neutral-500 dark:text-neutral-400" strokeWidth={2} />;
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

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center pl-3 pr-2.5 py-1.5 border-y border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 transition-colors group"
      >
        <div className="flex items-center" style={{ width: '20px' }}>
          <div className="text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-400">
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </div>
        </div>
        <div className="flex items-center" style={{ width: '20px' }}>
          <div className={`${summaryColorClass}`}>
            {summaryIcon}
          </div>
        </div>
        <span className={`text-[11px] font-semibold ${summaryColorClass}`}>{summaryText}</span>
      </button>
      {isExpanded && (
        <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border-b border-neutral-200 dark:border-neutral-800">
          {sortedRuns.map((run) => {
            const appLabel = run.type === 'check' && 'appSlug' in run && run.appSlug
              ? `[${run.appSlug}]`
              : run.type === 'check' && 'appName' in run && run.appName
                ? `[${run.appName}]`
                : run.type === 'deployment'
                  ? '[deployment]'
                  : run.type === 'status'
                    ? '[status]'
                    : null;

            return (
              <a
                key={`${run.type}-${run._id}`}
                href={run.url || '#'}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-2 pl-8 pr-3 py-1 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group"
              >
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <div className="shrink-0">
                    {getStatusIcon(run.status, run.conclusion)}
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    <div className="text-[11px] text-neutral-900 dark:text-neutral-100 font-normal truncate">
                      {run.name}
                    </div>
                    {appLabel && (
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-500 shrink-0">
                        {appLabel}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-neutral-600 dark:text-neutral-400 shrink-0">
                    {getStatusDescription(run)}
                  </div>
                </div>
                {run.url && (
                  <div className="p-1 shrink-0">
                    <ExternalLink className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
                  </div>
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute(
  "/_layout/$teamSlugOrId/task/$taskId/run/$runId/pr"
)({
  component: RunPullRequestPage,
  params: {
    parse: paramsSchema.parse,
    stringify: (params) => {
      return {
        taskId: params.taskId,
        runId: params.runId,
      };
    },
  },
  loader: async (opts) => {
    await Promise.all([
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.taskRuns.getByTask, {
          teamSlugOrId: opts.params.teamSlugOrId,
          taskId: opts.params.taskId,
        })
      ),
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.tasks.getById, {
          teamSlugOrId: opts.params.teamSlugOrId,
          id: opts.params.taskId,
        })
      ),
    ]);
  },
});

function RunPullRequestPage() {
  const { taskId, teamSlugOrId, runId } = Route.useParams();

  const task = useQuery(api.tasks.getById, {
    teamSlugOrId,
    id: taskId,
  });

  const taskRuns = useQuery(api.taskRuns.getByTask, {
    teamSlugOrId,
    taskId,
  });

  // Get the specific run from the URL parameter
  const selectedRun = useMemo(() => {
    return taskRuns?.find((run) => run._id === runId);
  }, [runId, taskRuns]);

  const pullRequests = useMemo(
    () => selectedRun?.pullRequests ?? [],
    [selectedRun?.pullRequests]
  );
  const [activeRepo, setActiveRepo] = useState<string | null>(() =>
    pullRequests[0]?.repoFullName ?? null
  );

  useEffect(() => {
    if (pullRequests.length === 0) {
      if (activeRepo !== null) {
        setActiveRepo(null);
      }
      return;
    }
    if (!activeRepo || !pullRequests.some((pr) => pr.repoFullName === activeRepo)) {
      setActiveRepo(pullRequests[0]?.repoFullName ?? null);
    }
  }, [pullRequests, activeRepo]);

  const activePullRequest = useMemo(() => {
    if (!activeRepo) return null;
    return pullRequests.find((pr) => pr.repoFullName === activeRepo) ?? null;
  }, [pullRequests, activeRepo]);

  const aggregatedUrl = selectedRun?.pullRequestUrl;
  const isPending = aggregatedUrl === "pending";
  const fallbackPullRequestUrl =
    aggregatedUrl && aggregatedUrl !== "pending" ? aggregatedUrl : undefined;

  const persistKey = useMemo(() => {
    const key = activeRepo ? `${runId}:${activeRepo}` : runId;
    return getTaskRunPullRequestPersistKey(key);
  }, [runId, activeRepo]);
  const paneBorderRadius = 6;

  // Only show checks for open PRs
  const shouldShowChecks = activePullRequest?.state === "open";
  const workflowData = useCombinedWorkflowData({
    teamSlugOrId,
    repoFullName: activePullRequest?.repoFullName || '',
    prNumber: activePullRequest?.number || 0,
    headSha: activePullRequest?.headSha,
  });

  const [checksExpanded, setChecksExpanded] = useState(false);

  const headerTitle = pullRequests.length > 1 ? "Pull Requests" : "Pull Request";
  const activeUrl = activePullRequest?.url ?? fallbackPullRequestUrl;

  return (
    <FloatingPane>
      <div className="flex h-full min-h-0 flex-col relative isolate">
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
          {/* Header */}
          <div className="border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {headerTitle}
              </h2>
              {selectedRun?.pullRequestState && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                  {selectedRun.pullRequestState}
                </span>
              )}
            </div>
            {activeUrl && (
              <a
                href={activeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                Open in GitHub
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            )}
          </div>

          {/* Task description */}
          {task?.text && (
            <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-800">
              <div className="text-xs text-neutral-600 dark:text-neutral-300">
                <span className="text-neutral-500 dark:text-neutral-400 select-none">
                  Task:{" "}
                </span>
                <span className="font-medium">{task.text}</span>
              </div>
            </div>
          )}

          {/* Checks and Actions */}
          {shouldShowChecks && (
            <Suspense fallback={null}>
              <ChecksActionsSection
                allRuns={workflowData.allRuns}
                isLoading={workflowData.isLoading}
                isExpanded={checksExpanded}
                onToggle={() => setChecksExpanded(!checksExpanded)}
              />
            </Suspense>
          )}

          {/* Main content */}
          <div className="flex-1 bg-white dark:bg-neutral-950">
            {pullRequests.length > 0 ? (
              <div className="flex h-full flex-col">
                <div className="flex flex-wrap border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/30">
                  {pullRequests.map((pr) => {
                    const isActive = pr.repoFullName === activeRepo;
                    return (
                      <button
                        key={pr.repoFullName}
                        onClick={() => setActiveRepo(pr.repoFullName)}
                        className={clsx(
                          "flex min-w-[160px] items-center justify-between gap-2 px-3 py-2 text-xs transition-colors",
                          isActive
                            ? "border-b-2 border-neutral-900 bg-white text-neutral-900 dark:border-neutral-100 dark:bg-neutral-950 dark:text-neutral-100"
                            : "border-b-2 border-transparent text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100",
                        )}
                      >
                        <span className="truncate">{pr.repoFullName}</span>
                        <span className="text-[10px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                          {pr.state ?? "none"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex-1">
                  {activePullRequest?.url ? (
                    <PersistentWebView
                      persistKey={persistKey}
                      src={activePullRequest.url}
                      className="w-full h-full border-0"
                      borderRadius={paneBorderRadius}
                      forceWebContentsViewIfElectron
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-6 text-sm text-neutral-500 dark:text-neutral-400">
                      No pull request URL available for this repository yet.
                    </div>
                  )}
                </div>
              </div>
            ) : isPending ? (
              <div className="flex flex-col items-center justify-center h-full text-neutral-500 dark:text-neutral-400">
                <div className="w-8 h-8 border-2 border-neutral-300 dark:border-neutral-600 border-t-blue-500 rounded-full animate-spin mb-4" />
                <p className="text-sm">Pull request is being created...</p>
              </div>
            ) : fallbackPullRequestUrl ? (
              <PersistentWebView
                persistKey={persistKey}
                src={fallbackPullRequestUrl}
                className="w-full h-full border-0"
                borderRadius={paneBorderRadius}
                forceWebContentsViewIfElectron
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-neutral-500 dark:text-neutral-400">
                <svg
                  className="w-16 h-16 mb-4 text-neutral-300 dark:text-neutral-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="text-sm font-medium mb-1">No pull request</p>
                <p className="text-xs text-center">
                  This run doesn't have any associated pull requests yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </FloatingPane>
  );
}
