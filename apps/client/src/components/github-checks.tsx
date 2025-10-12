import { api } from "@cmux/convex/api";
import { useQuery } from "convex/react";
import clsx from "clsx";
import { CheckCircle2, XCircle, Clock, Circle, AlertCircle, Loader2 } from "lucide-react";

interface GitHubChecksProps {
  teamSlugOrId: string;
  repoFullName: string;
  prNumber: number;
  headSha?: string;
}

type CheckStatus = "queued" | "in_progress" | "completed" | "pending" | "waiting" | undefined;
type CheckConclusion = "success" | "failure" | "neutral" | "cancelled" | "skipped" | "timed_out" | "action_required" | undefined;

function getStatusIcon(status: CheckStatus, conclusion: CheckConclusion) {
  // If completed, show conclusion icon
  if (status === "completed") {
    switch (conclusion) {
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case "failure":
        return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case "cancelled":
        return <Circle className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />;
      case "skipped":
        return <Circle className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />;
      case "timed_out":
        return <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" />;
      case "action_required":
        return <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />;
      case "neutral":
        return <Circle className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />;
    }
  }

  // Otherwise show status icon
  switch (status) {
    case "queued":
    case "pending":
    case "waiting":
      return <Clock className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />;
    case "in_progress":
      return <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />;
    default:
      return <Circle className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />;
  }
}

function getStatusText(status: CheckStatus, conclusion: CheckConclusion): string {
  if (status === "completed") {
    switch (conclusion) {
      case "success":
        return "Success";
      case "failure":
        return "Failed";
      case "cancelled":
        return "Cancelled";
      case "skipped":
        return "Skipped";
      case "timed_out":
        return "Timed out";
      case "action_required":
        return "Action required";
      case "neutral":
        return "Neutral";
      default:
        return "Completed";
    }
  }

  switch (status) {
    case "queued":
      return "Queued";
    case "pending":
      return "Pending";
    case "waiting":
      return "Waiting";
    case "in_progress":
      return "In progress";
    default:
      return "Unknown";
  }
}

export function GitHubChecks({ teamSlugOrId, repoFullName, prNumber, headSha }: GitHubChecksProps) {
  const checkRuns = useQuery(api.github_check_runs.getCheckRunsForPr, {
    teamSlugOrId,
    repoFullName,
    prNumber,
    headSha,
  });

  const workflowRuns = useQuery(api.github_workflows.getWorkflowRunsForPr, {
    teamSlugOrId,
    repoFullName,
    prNumber,
    headSha,
  });

  const isLoading = checkRuns === undefined || workflowRuns === undefined;
  const hasChecks = (checkRuns?.length ?? 0) > 0 || (workflowRuns?.length ?? 0) > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 text-neutral-400 dark:text-neutral-500 animate-spin" />
      </div>
    );
  }

  if (!hasChecks) {
    return null;
  }

  return (
    <div className="border-t border-neutral-200 dark:border-neutral-800">
      <div className="px-4 py-3">
        <h3 className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-3">
          Checks
        </h3>
        <div className="space-y-2">
          {/* Workflow runs (GitHub Actions) */}
          {workflowRuns?.map((run) => (
            <a
              key={run._id}
              href={run.htmlUrl ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                "hover:bg-neutral-50 dark:hover:bg-neutral-900/50",
                !run.htmlUrl && "pointer-events-none"
              )}
            >
              <div className="flex-shrink-0">
                {getStatusIcon(run.status, run.conclusion)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                  {run.workflowName}
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  {getStatusText(run.status, run.conclusion)}
                  {run.runDuration && run.status === "completed" && (
                    <span className="ml-1">
                      in {run.runDuration}s
                    </span>
                  )}
                </div>
              </div>
            </a>
          ))}

          {/* Check runs (third-party apps like Vercel) */}
          {checkRuns?.map((run) => (
            <a
              key={run._id}
              href={run.htmlUrl ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                "hover:bg-neutral-50 dark:hover:bg-neutral-900/50",
                !run.htmlUrl && "pointer-events-none"
              )}
            >
              <div className="flex-shrink-0">
                {getStatusIcon(run.status, run.conclusion)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                  {run.name}
                  {run.appName && (
                    <span className="ml-1.5 text-xs font-normal text-neutral-500 dark:text-neutral-400">
                      ({run.appName})
                    </span>
                  )}
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  {getStatusText(run.status, run.conclusion)}
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
