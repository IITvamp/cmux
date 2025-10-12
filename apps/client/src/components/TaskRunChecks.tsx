import { api } from "@cmux/convex/api";
import { useQuery as useConvexQuery } from "convex/react";
import { ExternalLink, Check, Circle, Clock, AlertCircle, Loader2 } from "lucide-react";
import { useMemo } from "react";
import type { StoredPullRequestInfo } from "@cmux/shared/pull-request-state";

type CombinedRun = {
  name: string;
  status: string | undefined;
  conclusion: string | undefined;
  timestamp: number;
  url: string;
  type: 'check' | 'workflow' | 'deployment' | 'status';
  appName?: string;
  appSlug?: string;
};

interface TaskRunChecksProps {
  teamSlugOrId: string;
  pullRequests: readonly StoredPullRequestInfo[];
  headSha?: string | null;
}

function useCombinedWorkflowDataForPR({
  teamSlugOrId,
  repoFullName,
  prNumber,
  headSha
}: {
  teamSlugOrId: string;
  repoFullName: string;
  prNumber: number;
  headSha?: string | null;
}) {
  const workflowRuns = useConvexQuery(api.github_workflows.getWorkflowRunsForPr, {
    teamSlugOrId,
    repoFullName,
    prNumber,
    headSha: headSha || undefined,
    limit: 50,
  });

  const checkRuns = useConvexQuery(api.github_check_runs.getCheckRunsForPr, {
    teamSlugOrId,
    repoFullName,
    prNumber,
    headSha: headSha || undefined,
    limit: 50,
  });

  const deployments = useConvexQuery(api.github_deployments.getDeploymentsForPr, {
    teamSlugOrId,
    repoFullName,
    prNumber,
    headSha: headSha || undefined,
    limit: 50,
  });

  const commitStatuses = useConvexQuery(api.github_commit_statuses.getCommitStatusesForPr, {
    teamSlugOrId,
    repoFullName,
    prNumber,
    headSha: headSha || undefined,
    limit: 50,
  });

  const isLoading = workflowRuns === undefined || checkRuns === undefined || deployments === undefined || commitStatuses === undefined;

  const allRuns = useMemo(() => {
    if (isLoading) return [];

    return [
      ...(workflowRuns || []).map(run => ({
        ...run,
        type: 'workflow' as const,
        name: run.workflowName,
        timestamp: run.runStartedAt,
        url: run.htmlUrl,
      })),
      ...(checkRuns || []).map(run => {
        const url = run.htmlUrl || `https://github.com/${repoFullName}/pull/${prNumber}/checks?check_run_id=${run.checkRunId}`;
        return {
          ...run,
          type: 'check' as const,
          timestamp: run.startedAt,
          url,
        };
      }),
      ...(deployments || []).filter(dep => dep.environment !== 'Preview').map(dep => ({
        ...dep,
        type: 'deployment' as const,
        name: dep.description || dep.environment || 'Deployment',
        timestamp: dep.createdAt,
        status: dep.state === 'pending' || dep.state === 'queued' || dep.state === 'in_progress' ? 'in_progress' : 'completed',
        conclusion: dep.state === 'success' ? 'success' : dep.state === 'failure' || dep.state === 'error' ? 'failure' : undefined,
        url: dep.targetUrl,
      })),
      ...(commitStatuses || []).map(status => ({
        ...status,
        type: 'status' as const,
        timestamp: status.createdAt,
      })),
    ]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20); // Limit to 20 most recent

  }, [workflowRuns, checkRuns, deployments, commitStatuses, isLoading, repoFullName, prNumber]);

  return { allRuns, isLoading };
}

export function TaskRunChecks({ teamSlugOrId, pullRequests, headSha }: TaskRunChecksProps) {
  // Find the first open PR
  const openPR = pullRequests.find(pr => pr.state === "open");

  if (!openPR || !openPR.number) {
    return null; // Don't show anything if no open PR with number
  }

  const { allRuns, isLoading } = useCombinedWorkflowDataForPR({
    teamSlugOrId,
    repoFullName: openPR.repoFullName,
    prNumber: openPR.number,
    headSha,
  });

  if (isLoading) {
    return (
      <div className="px-3.5 py-2 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading checks...
        </div>
      </div>
    );
  }

  if (allRuns.length === 0) {
    return (
      <div className="px-3.5 py-2 border-b border-neutral-200 dark:border-neutral-800">
        <div className="text-xs text-neutral-600 dark:text-neutral-300">
          No checks found for open pull request.
        </div>
      </div>
    );
  }

  const hasAnyFailure = allRuns.some(run =>
    run.conclusion === 'failure' || run.conclusion === 'cancelled' || run.conclusion === 'timed_out'
  );

  const failedRuns = allRuns.filter(run =>
    run.conclusion === 'failure' || run.conclusion === 'cancelled' || run.conclusion === 'timed_out'
  );

  return (
    <div className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="px-3.5 py-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
              Checks
            </h3>
            {hasAnyFailure ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                {failedRuns.length} failed
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                All passed
              </span>
            )}
          </div>
        </div>

        <div className="space-y-1">
          {allRuns.slice(0, 10).map((run, index) => (
            <div key={`${run.type}-${run.name}-${index}`} className="flex items-center gap-2 text-xs">
              <StatusIcon status={run.status} conclusion={run.conclusion} />
              <span className="flex-1 truncate text-neutral-700 dark:text-neutral-300">
                {run.name}
              </span>
              {run.appSlug && (
                <span className="text-neutral-500 dark:text-neutral-400 text-[10px] uppercase">
                  {run.appSlug}
                </span>
              )}
              <a
                href={run.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))}
          {allRuns.length > 10 && (
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              And {allRuns.length - 10} more...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status, conclusion }: { status?: string; conclusion?: string }) {
  if (conclusion === 'success') {
    return <Check className="w-3 h-3 text-green-600" />;
  }
  if (conclusion === 'failure' || conclusion === 'cancelled' || conclusion === 'timed_out') {
    return <AlertCircle className="w-3 h-3 text-red-600" />;
  }
  if (status === 'in_progress' || status === 'pending' || status === 'queued' || status === 'waiting') {
    return <Clock className="w-3 h-3 text-yellow-600" />;
  }
  return <Circle className="w-3 h-3 text-neutral-400" />;
}