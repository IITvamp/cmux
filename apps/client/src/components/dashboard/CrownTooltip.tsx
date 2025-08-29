import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isFakeConvexId } from "@/lib/fakeConvexId";
import { api } from "@cmux/convex/api";
import type { Id } from "@cmux/convex/dataModel";
import { useQuery } from "convex/react";
// Read team slug from path to avoid route type coupling
import { AlertCircle, Crown, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface CrownStatusProps {
  taskId: Id<"tasks">;
  teamSlugOrId: string;
}

export function CrownStatus({ taskId, teamSlugOrId }: CrownStatusProps) {
  // Get task runs
  const taskRuns = useQuery(
    api.taskRuns.getByTask,
    isFakeConvexId(taskId) ? "skip" : { teamIdOrSlug: teamSlugOrId, taskId }
  );

  // Get task with error status
  const task = useQuery(
    api.tasks.getById,
    isFakeConvexId(taskId) ? "skip" : { teamIdOrSlug: teamSlugOrId, id: taskId }
  );

  // Get crown evaluation
  const crownedRun = useQuery(
    api.crown.getCrownedRun,
    isFakeConvexId(taskId) ? "skip" : { teamIdOrSlug: teamSlugOrId, taskId }
  );

  // BAD STATE
  const [showStatus, setShowStatus] = useState(false);
  // this is bad effect:
  useEffect(() => {
    // Show status when we have multiple runs
    if (taskRuns && taskRuns.length >= 2) {
      setShowStatus(true);
    }
  }, [taskRuns]);

  // instead, showStatus should NOT be a useState. it can just be derived:
  // const showStatus = taskRuns && taskRuns.length >= 2;

  if (!showStatus || !taskRuns || taskRuns.length < 2) {
    return null;
  }

  const completedRuns = taskRuns.filter((run) => run.status === "completed");
  const allCompleted = taskRuns.every(
    (run) => run.status === "completed" || run.status === "failed"
  );

  // Extract agent names
  const getAgentName = (prompt: string) => {
    const match = prompt.match(/\(([^)]+)\)$/);
    return match ? match[1] : "Unknown";
  };

  // Determine the status pill content
  let pillContent;
  let pillClassName =
    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium";

  if (!allCompleted) {
    const waitingContent = (
      <>
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>
          Waiting for models ({completedRuns.length}/{taskRuns.length})
        </span>
      </>
    );

    pillContent = (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 cursor-help">
              {waitingContent}
            </div>
          </TooltipTrigger>
          <TooltipContent
            className="max-w-sm p-3 z-[9999]"
            side="bottom"
            sideOffset={5}
          >
            <div className="space-y-2">
              <p className="font-medium text-sm">Crown Evaluation System</p>
              <p className="text-xs text-muted-foreground">
                Multiple AI models are working on your task in parallel. Once
                all models complete, Claude will evaluate and select the best
                implementation.
              </p>
              <div className="border-t pt-2 mt-2">
                <p className="text-xs font-medium mb-1">Competing models:</p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {taskRuns.map((run, idx) => {
                    const agentName = getAgentName(run.prompt);
                    const status =
                      run.status === "completed"
                        ? "✓"
                        : run.status === "running"
                          ? "⏳"
                          : run.status === "failed"
                            ? "✗"
                            : "•";
                    return (
                      <li key={idx}>
                        {status} {agentName}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    pillClassName +=
      " bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
  } else if (crownedRun) {
    const winnerContent = (
      <>
        <Crown className="w-3 h-3" />
        <span>Winner: {getAgentName(crownedRun.prompt)}</span>
      </>
    );

    // If we have a reason, wrap in tooltip
    if (crownedRun.crownReason) {
      pillContent = (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 cursor-help">
                {winnerContent}
              </div>
            </TooltipTrigger>
            <TooltipContent
              className="max-w-sm p-3 z-[9999]"
              side="bottom"
              sideOffset={5}
            >
              <div className="space-y-2">
                <p className="font-medium text-sm">Evaluation Reason</p>
                <p className="text-xs text-muted-foreground">
                  {crownedRun.crownReason}
                </p>
                <p className="text-xs text-muted-foreground border-t pt-2 mt-2">
                  Evaluated against {taskRuns.length} implementations
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    } else {
      pillContent = winnerContent;
    }

    pillClassName +=
      " bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  } else if (
    task?.crownEvaluationError === "pending_evaluation" ||
    task?.crownEvaluationError === "in_progress"
  ) {
    const evaluatingContent = (
      <>
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Evaluating...</span>
      </>
    );

    pillContent = (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 cursor-help">
              {evaluatingContent}
            </div>
          </TooltipTrigger>
          <TooltipContent
            className="max-w-sm p-3 z-[9999]"
            side="bottom"
            sideOffset={5}
          >
            <div className="space-y-2">
              <p className="font-medium text-sm">AI Judge in Progress</p>
              <p className="text-xs text-muted-foreground">
                Claude is analyzing the code implementations from all models to
                determine which one best solves your task. The evaluation
                considers code quality, completeness, best practices, and
                correctness.
              </p>
              <div className="border-t pt-2 mt-2">
                <p className="text-xs font-medium mb-1">
                  Completed implementations:
                </p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {completedRuns.map((run, idx) => {
                    const agentName = getAgentName(run.prompt);
                    return <li key={idx}>• {agentName}</li>;
                  })}
                </ul>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    pillClassName +=
      " bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
  } else if (task?.crownEvaluationError) {
    pillContent = (
      <>
        <AlertCircle className="w-3 h-3" />
        <span>Evaluation failed</span>
      </>
    );
    pillClassName +=
      " bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
  } else {
    pillContent = (
      <>
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Pending evaluation</span>
      </>
    );
    pillClassName +=
      " bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
  }

  return (
    <div className="mt-2 mb-4">
      <div className={pillClassName}>{pillContent}</div>
    </div>
  );
}
