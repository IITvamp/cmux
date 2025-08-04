import { api } from "@cmux/convex/api";
import type { Id } from "@cmux/convex/dataModel";
import { useQuery } from "convex/react";
import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface CrownEvaluationProps {
  taskId: Id<"tasks">;
}

export function CrownEvaluation({ taskId }: CrownEvaluationProps) {
  const evaluation = useQuery(api.crown.getCrownEvaluation, { taskId });
  const crownedRun = useQuery(api.crown.getCrownedRun, { taskId });

  if (!evaluation || !crownedRun) {
    return null;
  }

  // Extract agent name from prompt
  const agentMatch = crownedRun.prompt.match(/\(([^)]+)\)$/);
  const agentName = agentMatch ? agentMatch[1] : "Unknown";

  return (
    <Card className="border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
          Crown Winner: {agentName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-sm text-neutral-600 dark:text-neutral-400 mb-1">
              Evaluation Reason
            </h4>
            <p className="text-sm text-neutral-800 dark:text-neutral-200">
              {crownedRun.crownReason || "This implementation was selected as the best solution."}
            </p>
          </div>

          {crownedRun.pullRequestUrl && crownedRun.pullRequestUrl !== "pending" && (
            <div>
              <h4 className="font-medium text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                Pull Request
              </h4>
              <a
                href={crownedRun.pullRequestUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                View PR on GitHub →
              </a>
            </div>
          )}

          <div className="pt-2 border-t border-yellow-200 dark:border-yellow-800">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Evaluated against {evaluation.candidateRunIds.length} implementations
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}