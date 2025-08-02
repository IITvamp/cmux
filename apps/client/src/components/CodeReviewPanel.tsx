import { api } from "@cmux/convex/api";
import type { Doc } from "@cmux/convex/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Award, Loader2, Trophy } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { CrownBadge } from "./ui/crown";
import { cn } from "@/lib/utils";

interface CodeReviewPanelProps {
  task: Doc<"tasks">;
  taskRuns: Doc<"taskRuns">[];
}

export function CodeReviewPanel({ task, taskRuns }: CodeReviewPanelProps) {
  const [isReviewing, setIsReviewing] = useState(false);
  // TODO: Uncomment when Convex is running and codeReviews API is generated
  // const codeReview = useQuery(api.codeReviews.getByTaskId, { taskId: task._id });
  const codeReview = null;
  
  const completedRuns = taskRuns.filter(run => run.status === "completed");
  const hasCompletedRuns = completedRuns.length > 0;
  const hasMultipleRuns = completedRuns.length > 1;

  const handleStartReview = async () => {
    if (!hasMultipleRuns) return;
    
    setIsReviewing(true);
    try {
      const response = await fetch("/api/code-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task._id }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to start code review");
      }
    } catch (error) {
      console.error("Code review error:", error);
      alert("Failed to start code review. Make sure OpenAI API key is configured.");
    } finally {
      setIsReviewing(false);
    }
  };

  if (!hasCompletedRuns) {
    return (
      <div className="p-4 border rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          No completed task runs available for review.
        </p>
      </div>
    );
  }

  if (!hasMultipleRuns) {
    return (
      <div className="p-4 border rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Need at least 2 completed runs to perform code review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!codeReview && (
        <div className="p-4 border rounded-lg bg-white dark:bg-neutral-800">
          <h3 className="text-sm font-medium mb-2">Code Review</h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
            Compare {completedRuns.length} completed runs and crown the best solution.
          </p>
          <Button
            onClick={handleStartReview}
            disabled={isReviewing}
            className="w-full"
            size="sm"
          >
            {isReviewing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Reviewing...
              </>
            ) : (
              <>
                <Trophy className="w-4 h-4 mr-2" />
                Start Code Review
              </>
            )}
          </Button>
        </div>
      )}

      {codeReview && codeReview.status === "reviewing" && (
        <div className="p-4 border rounded-lg bg-white dark:bg-neutral-800">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Analyzing code outputs...</span>
          </div>
        </div>
      )}

      {codeReview && codeReview.status === "completed" && (
        <div className="space-y-4">
          <div className="p-4 border rounded-lg bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              <h3 className="text-sm font-medium">Code Review Complete</h3>
            </div>
            
            {codeReview.taskRuns.map((runReview) => {
              const isWinner = runReview.taskRunId === codeReview.winnerId;
              return (
                <div
                  key={runReview.taskRunId}
                  className={cn(
                    "p-3 rounded-lg border mb-2",
                    isWinner
                      ? "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700"
                      : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{runReview.agentName}</span>
                      {isWinner && <CrownBadge>Winner</CrownBadge>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Award className="w-4 h-4 text-neutral-500" />
                      <span className="text-sm font-bold">{runReview.evaluation.score}/100</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-neutral-600 dark:text-neutral-400">Code Quality:</span>
                      <span className="font-medium">{runReview.evaluation.codeQuality}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600 dark:text-neutral-400">Requirements:</span>
                      <span className="font-medium">{runReview.evaluation.adherenceToRequirements}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600 dark:text-neutral-400">Performance:</span>
                      <span className="font-medium">{runReview.evaluation.performance}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600 dark:text-neutral-400">Security:</span>
                      <span className="font-medium">{runReview.evaluation.security}%</span>
                    </div>
                  </div>
                  
                  {isWinner && (
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2 italic">
                      {runReview.evaluation.reasoning}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}