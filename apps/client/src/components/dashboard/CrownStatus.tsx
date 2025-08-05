import { api } from "@cmux/convex/api";
import type { Id } from "@cmux/convex/dataModel";
import { useQuery } from "convex/react";
import { Crown, Loader2, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface CrownStatusProps {
  taskId: Id<"tasks">;
}

export function CrownStatus({ taskId }: CrownStatusProps) {
  const [showStatus, setShowStatus] = useState(false);
  
  // Get task runs
  const taskRuns = useQuery(api.taskRuns.getByTask, { taskId });
  
  // Get task with error status
  const task = useQuery(api.tasks.getById, { id: taskId });
  
  // Get crown evaluation
  const crownedRun = useQuery(api.crown.getCrownedRun, { taskId });

  useEffect(() => {
    // Show status when we have multiple runs
    if (taskRuns && taskRuns.length >= 2) {
      setShowStatus(true);
    }
  }, [taskRuns]);

  if (!showStatus || !taskRuns || taskRuns.length < 2) {
    return null;
  }

  const completedRuns = taskRuns.filter(run => run.status === "completed");
  const allCompleted = taskRuns.every(run => run.status === "completed" || run.status === "failed");

  // Extract agent names
  const getAgentName = (prompt: string) => {
    const match = prompt.match(/\(([^)]+)\)$/);
    return match ? match[1] : "Unknown";
  };

  return (
    <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-900">
      <div className="flex items-start gap-3">
        <Crown className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <h3 className="font-medium text-sm text-yellow-900 dark:text-yellow-100">
            Crown Evaluation
          </h3>
          
          {!allCompleted ? (
            <div className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>
                Waiting for all models to complete ({completedRuns.length}/{taskRuns.length} done)
              </span>
            </div>
          ) : crownedRun ? (
            <div className="space-y-2">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <span className="font-medium">Winner:</span> {getAgentName(crownedRun.prompt)}
              </p>
              {crownedRun.crownReason && (
                <p className="text-xs text-yellow-700 dark:text-yellow-300 italic">
                  "{crownedRun.crownReason}"
                </p>
              )}
              {crownedRun.pullRequestUrl && crownedRun.pullRequestUrl !== "pending" && (
                <a
                  href={crownedRun.pullRequestUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View Pull Request →
                </a>
              )}
            </div>
          ) : task?.crownEvaluationError === "pending_evaluation" ? (
            <div className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Claude Code is evaluating implementations...</span>
            </div>
          ) : task?.crownEvaluationError ? (
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-700 dark:text-red-300">
                  Crown evaluation failed
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {task.crownEvaluationError}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Evaluating implementations...</span>
            </div>
          )}
          
          <div className="mt-2 pt-2 border-t border-yellow-200 dark:border-yellow-800">
            <p className="text-xs text-yellow-600 dark:text-yellow-400">
              Competing models: {taskRuns.map(run => getAgentName(run.prompt)).join(", ")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}