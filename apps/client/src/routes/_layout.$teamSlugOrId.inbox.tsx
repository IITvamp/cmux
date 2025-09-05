import { api } from "@cmux/convex/api";
import type { Doc } from "@cmux/convex/dataModel";
import { useQuery } from "convex/react";
import { createFileRoute } from "@tanstack/react-router";
import { Crown, Clock, GitBranch, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/$teamSlugOrId/inbox")({
  component: InboxView,
});

function InboxView() {
  const { teamSlugOrId } = Route.useParams();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  
  // Fetch recently completed runs
  const recentRuns = useQuery(api.taskRuns.getRecentlyCompleted, { 
    teamSlugOrId,
    limit: 50,
  });

  // Fetch all tasks to get their titles
  const allTasks = useQuery(api.tasks.get, { teamSlugOrId });

  // Group runs by task and enrich with task data
  const groupedByTask = useMemo(() => {
    if (!recentRuns || !allTasks) return [];
    
    const taskMap = new Map(allTasks.map(t => [t._id, t]));
    const taskRunGroups = new Map<string, {
      task: Doc<"tasks"> | undefined;
      runs: Doc<"taskRuns">[];
      latestCompletedAt: number;
      hasCrowned: boolean;
    }>();
    
    recentRuns.forEach((run) => {
      if (!taskRunGroups.has(run.taskId)) {
        taskRunGroups.set(run.taskId, {
          task: taskMap.get(run.taskId),
          runs: [],
          latestCompletedAt: 0,
          hasCrowned: false,
        });
      }
      
      const group = taskRunGroups.get(run.taskId)!;
      group.runs.push(run);
      group.latestCompletedAt = Math.max(group.latestCompletedAt, run.completedAt || 0);
      if (run.isCrowned) group.hasCrowned = true;
    });
    
    // Sort by: crowned first, then by latest completion time
    return Array.from(taskRunGroups.values())
      .filter(g => g.task) // Only show groups with valid tasks
      .sort((a, b) => {
        if (a.hasCrowned && !b.hasCrowned) return -1;
        if (!a.hasCrowned && b.hasCrowned) return 1;
        return b.latestCompletedAt - a.latestCompletedAt;
      });
  }, [recentRuns, allTasks]);

  const selectedRun = recentRuns?.find(r => r._id === selectedRunId);

  return (
    <div className="flex h-full">
      {/* Left sidebar - Task list */}
      <div className="w-80 border-r border-neutral-200 dark:border-neutral-800 overflow-y-auto">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Recently Completed
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Tasks finished in the last 7 days
          </p>
        </div>
        
        <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {!recentRuns || !allTasks ? (
            <div className="p-4 text-sm text-neutral-500 dark:text-neutral-400">
              Loading...
            </div>
          ) : groupedByTask.length === 0 ? (
            <div className="p-4 text-sm text-neutral-500 dark:text-neutral-400">
              No recently completed tasks
            </div>
          ) : (
            groupedByTask.map((group) => {
              const { task, runs, hasCrowned } = group;
              if (!task) return null;
              
              const crownedRun = runs.find(r => r.isCrowned);
              const latestRun = runs.sort((a, b) => 
                (b.completedAt || 0) - (a.completedAt || 0)
              )[0];
              const displayRun = crownedRun || latestRun;
              
              return (
                <div
                  key={task._id}
                  className={`p-3 hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer ${
                    selectedRunId === displayRun._id ? 'bg-neutral-100 dark:bg-neutral-900' : ''
                  }`}
                  onClick={() => setSelectedRunId(displayRun._id)}
                >
                  <div className="flex items-start gap-2">
                    {hasCrowned && (
                      <Crown className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                        {task.text}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(displayRun.completedAt || 0, { addSuffix: true })}
                        </span>
                        {runs.length > 1 && (
                          <span>{runs.length} runs</span>
                        )}
                      </div>
                      {displayRun.agentName && (
                        <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                          {displayRun.agentName}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right panel - Run details */}
      <div className="flex-1 overflow-y-auto">
        {selectedRun ? (
          <div className="p-6">
            <div className="mb-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                    {allTasks?.find(t => t._id === selectedRun.taskId)?.text || selectedRun.prompt.split('\n')[0]}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
                    {selectedRun.isCrowned && (
                      <span className="flex items-center gap-1 text-yellow-500">
                        <Crown className="w-4 h-4" />
                        Crowned Winner
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Completed {formatDistanceToNow(selectedRun.completedAt || 0, { addSuffix: true })}
                    </span>
                    {selectedRun.agentName && (
                      <span>{selectedRun.agentName}</span>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Link
                    to="/$teamSlugOrId/task/$taskId/run/$runId/diff"
                    params={{
                      teamSlugOrId,
                      taskId: selectedRun.taskId,
                      runId: selectedRun._id,
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md transition-colors"
                  >
                    <GitBranch className="w-4 h-4" />
                    View Diff
                  </Link>
                  
                  {selectedRun.pullRequestUrl && (
                    <a
                      href={selectedRun.pullRequestUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View PR
                    </a>
                  )}
                  
                  {selectedRun.vscode?.url && (
                    <Link
                      to="/$teamSlugOrId/task/$taskId/run/$runId/vscode"
                      params={{
                        teamSlugOrId,
                        taskId: selectedRun.taskId,
                        runId: selectedRun._id,
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md transition-colors"
                    >
                      Open VSCode
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {selectedRun.summary && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                  Summary
                </h4>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: selectedRun.summary }} />
                </div>
              </div>
            )}

            {selectedRun.crownReason && (
              <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2 flex items-center gap-1">
                  <Crown className="w-4 h-4" />
                  Crown Evaluation
                </h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  {selectedRun.crownReason}
                </p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                Details
              </h4>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-neutral-500 dark:text-neutral-400">Branch</dt>
                  <dd className="text-neutral-900 dark:text-neutral-100 font-mono">
                    {selectedRun.newBranch || "N/A"}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500 dark:text-neutral-400">Exit Code</dt>
                  <dd className="text-neutral-900 dark:text-neutral-100">
                    {selectedRun.exitCode ?? "N/A"}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500 dark:text-neutral-400">PR State</dt>
                  <dd className="text-neutral-900 dark:text-neutral-100">
                    {selectedRun.pullRequestState || "none"}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500 dark:text-neutral-400">Duration</dt>
                  <dd className="text-neutral-900 dark:text-neutral-100">
                    {selectedRun.completedAt && selectedRun.createdAt
                      ? formatDistanceToNow(selectedRun.completedAt - selectedRun.createdAt)
                      : "N/A"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-neutral-500 dark:text-neutral-400">
            Select a task to view details
          </div>
        )}
      </div>
    </div>
  );
}