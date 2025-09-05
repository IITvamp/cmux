import { api } from "@cmux/convex/api";
import type { Doc } from "@cmux/convex/dataModel";
import { useQuery as useConvexQuery } from "convex/react";
import { Check, Clock, Crown, Loader2, Trophy } from "lucide-react";
import { memo, useState } from "react";
import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";

interface TaskInboxProps {
  teamSlugOrId: string;
}

interface TaskWithRuns {
  task: Doc<"tasks">;
  runs: Doc<"taskRuns">[];
  latestRun?: Doc<"taskRuns">;
  crownedRun?: Doc<"taskRuns">;
  isPendingCrownEvaluation?: boolean;
  crownEvaluation?: Doc<"crownEvaluations">;
  completedAt?: number;
}

export const TaskInbox = memo(function TaskInbox({
  teamSlugOrId,
}: TaskInboxProps) {
  const [selectedTask, setSelectedTask] = useState<TaskWithRuns | null>(null);

  // Fetch recently completed tasks
  const tasksQuery = useConvexQuery(api.inbox.getRecentlyCompletedTasks, {
    teamSlugOrId,
    limit: 30,
  });

  const tasks = tasksQuery || [];

  if (!tasksQuery) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-500 dark:text-neutral-400">
        <Trophy className="w-12 h-12 mb-4 text-neutral-300 dark:text-neutral-600" />
        <p className="text-sm font-medium">No completed tasks yet</p>
        <p className="text-xs mt-1">Completed tasks will appear here</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left panel - Task list */}
      <div className="w-1/3 min-w-[320px] max-w-[400px] border-r border-neutral-200 dark:border-neutral-700 overflow-y-auto">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Recently Completed
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {tasks.length} task{tasks.length !== 1 ? "s" : ""} completed
          </p>
        </div>
        
        <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
          {tasks.map((taskWithRuns: TaskWithRuns) => {
            const { task, crownedRun, isPendingCrownEvaluation, runs } = taskWithRuns;
            const isSelected = selectedTask?.task._id === task._id;
            const timeAgo = taskWithRuns.completedAt 
              ? formatDistanceToNow(new Date(taskWithRuns.completedAt), { addSuffix: true })
              : "";

            return (
              <button
                key={task._id}
                onClick={() => setSelectedTask(taskWithRuns)}
                className={clsx(
                  "w-full text-left p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors",
                  isSelected && "bg-neutral-50 dark:bg-neutral-800/50"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {isPendingCrownEvaluation ? (
                      <div className="w-5 h-5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                        <Clock className="w-3 h-3 text-yellow-600 dark:text-yellow-500" />
                      </div>
                    ) : crownedRun ? (
                      <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <Crown className="w-3 h-3 text-green-600 dark:text-green-500" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Check className="w-3 h-3 text-blue-600 dark:text-blue-500" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                      {task.text}
                    </p>
                    
                    <div className="flex items-center gap-2 mt-1">
                      {task.projectFullName && (
                        <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                          {task.projectFullName.split("/")[1]}
                        </span>
                      )}
                      
                      {runs.length > 1 && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                          {runs.length} runs
                        </span>
                      )}
                      
                      {isPendingCrownEvaluation && (
                        <span className="text-xs text-yellow-600 dark:text-yellow-500">
                          Evaluating...
                        </span>
                      )}
                    </div>
                    
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                      {timeAgo}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right panel - Task details */}
      <div className="flex-1 overflow-y-auto">
        {selectedTask ? (
          <TaskDetails taskWithRuns={selectedTask} />
        ) : (
          <div className="flex items-center justify-center h-full text-neutral-400 dark:text-neutral-500">
            <p className="text-sm">Select a task to view details</p>
          </div>
        )}
      </div>
    </div>
  );
});

function TaskDetails({ taskWithRuns }: { taskWithRuns: TaskWithRuns }) {
  const { task, runs, crownedRun, isPendingCrownEvaluation, crownEvaluation } = taskWithRuns;
  
  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          {task.text}
        </h3>
        
        {task.description && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            {task.description}
          </p>
        )}
        
        <div className="flex flex-wrap gap-2">
          {task.projectFullName && (
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
              {task.projectFullName}
            </span>
          )}
          
          {task.baseBranch && (
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
              {task.baseBranch}
            </span>
          )}
          
          {task.mergeStatus && task.mergeStatus !== "none" && (
            <span className={clsx(
              "inline-flex items-center px-2 py-1 rounded-md text-xs font-medium",
              task.mergeStatus === "pr_merged" && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
              task.mergeStatus === "pr_open" && "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
              task.mergeStatus === "pr_draft" && "bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400",
              task.mergeStatus === "pr_closed" && "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
            )}>
              {task.mergeStatus.replace(/_/g, " ").toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* Task Runs */}
      <div>
        <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
          Agent Runs ({runs.length})
        </h4>
        
        <div className="space-y-3">
          {runs.map((run) => {
            const isCrowned = run._id === crownedRun?._id;
            
            return (
              <div
                key={run._id}
                className={clsx(
                  "border rounded-lg p-4",
                  isCrowned 
                    ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20" 
                    : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {run.agentName || "Unknown Agent"}
                      </span>
                      
                      {isCrowned && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 text-xs font-medium">
                          <Crown className="w-3 h-3" />
                          Winner
                        </span>
                      )}
                    </div>
                    
                    {run.summary && (
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                        {run.summary}
                      </p>
                    )}
                    
                    {isCrowned && crownEvaluation?.evaluationResponse && (
                      <div className="mt-2 p-2 rounded bg-green-100/50 dark:bg-green-900/30">
                        <p className="text-xs text-green-700 dark:text-green-400 font-medium mb-1">
                          Crown Evaluation:
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-500">
                          {run.crownReason || crownEvaluation.evaluationResponse}
                        </p>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                      {run.completedAt && (
                        <span>
                          Completed {formatDistanceToNow(new Date(run.completedAt), { addSuffix: true })}
                        </span>
                      )}
                      
                      {run.pullRequestUrl && (
                        <a
                          href={run.pullRequestUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          View PR
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {isPendingCrownEvaluation && (
          <div className="mt-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-yellow-600 dark:text-yellow-500" />
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                Crown evaluation in progress...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}