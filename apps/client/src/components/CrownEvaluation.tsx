import { isFakeConvexId } from "@/lib/fakeConvexId";
import { api } from "@cmux/convex/api";
import type { Id } from "@cmux/convex/dataModel";
import { useQuery } from "convex/react";
// Read team slug from path to avoid route type coupling
import { Trophy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface CrownEvaluationProps {
  taskId: Id<"tasks">;
  teamSlugOrId: string;
}

export function CrownEvaluation({
  taskId,
  teamSlugOrId,
}: CrownEvaluationProps) {
  const evaluation = useQuery(
    api.crown.getCrownEvaluation,
    isFakeConvexId(taskId) ? "skip" : { teamSlugOrId, taskId }
  );
  const crownedRun = useQuery(
    api.crown.getCrownedRun,
    isFakeConvexId(taskId) ? "skip" : { teamSlugOrId, taskId }
  );

  if (!evaluation || !crownedRun) {
    return null;
  }

  // Prefer stored agentName, use "Unknown" when missing
  const crownedPullRequests = crownedRun.pullRequests ?? [];
  const fallbackPullRequestUrl =
    crownedRun.pullRequestUrl && crownedRun.pullRequestUrl !== "pending"
      ? crownedRun.pullRequestUrl
      : undefined;

  // Prefer stored agentName, use "Unknown" when missing
  const storedAgentName = crownedRun.agentName?.trim();
  const agentName =
    storedAgentName && storedAgentName.length > 0 ? storedAgentName : "unknown agent";

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
            <div className="text-sm text-neutral-800 dark:text-neutral-200
              prose prose-neutral dark:prose-invert prose-sm max-w-none
              prose-p:my-1.5 prose-p:leading-relaxed
              prose-headings:mt-4 prose-headings:mb-3 prose-headings:font-semibold
              prose-h1:text-xl prose-h1:mt-5 prose-h1:mb-3
              prose-h2:text-lg prose-h2:mt-4 prose-h2:mb-2.5
              prose-h3:text-base prose-h3:mt-3.5 prose-h3:mb-2
              prose-ul:my-2 prose-ul:list-disc prose-ul:pl-5
              prose-ol:my-2 prose-ol:list-decimal prose-ol:pl-5
              prose-li:my-0.5
              prose-blockquote:border-l-4 prose-blockquote:border-neutral-300 dark:prose-blockquote:border-neutral-600
              prose-blockquote:pl-4 prose-blockquote:py-0.5 prose-blockquote:my-2
              prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:bg-neutral-200 dark:prose-code:bg-neutral-700
              prose-code:text-[13px] prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-neutral-900 dark:prose-pre:bg-neutral-800 prose-pre:text-neutral-100
              prose-pre:p-3 prose-pre:rounded-md prose-pre:my-2 prose-pre:overflow-x-auto
              prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:underline prose-a:break-words
              prose-table:my-2 prose-table:border prose-table:border-neutral-300 dark:prose-table:border-neutral-600
              prose-th:p-2 prose-th:bg-neutral-100 dark:prose-th:bg-neutral-800
              prose-td:p-2 prose-td:border prose-td:border-neutral-300 dark:prose-td:border-neutral-600
              prose-hr:my-3 prose-hr:border-neutral-300 dark:prose-hr:border-neutral-600
              prose-strong:font-semibold prose-strong:text-neutral-900 dark:prose-strong:text-neutral-100">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {crownedRun.crownReason ||
                  "This implementation was selected as the best solution."}
              </ReactMarkdown>
            </div>
          </div>

          {crownedPullRequests.length > 0 ? (
            <div>
              <h4 className="font-medium text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                Pull Requests
              </h4>
              <div className="flex flex-col gap-1">
                {crownedPullRequests.map((pr) => (
                  pr.url ? (
                    <a
                      key={pr.repoFullName}
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {pr.repoFullName} ({pr.state ?? "none"}) →
                    </a>
                  ) : (
                    <span
                      key={pr.repoFullName}
                      className="text-sm text-neutral-500 dark:text-neutral-400"
                    >
                      {pr.repoFullName} ({pr.state ?? "none"})
                    </span>
                  )
                ))}
              </div>
            </div>
          ) : fallbackPullRequestUrl ? (
            <div>
              <h4 className="font-medium text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                Pull Request
              </h4>
              <a
                href={fallbackPullRequestUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {crownedRun.pullRequestIsDraft ? "View draft PR" : "View PR"} →
              </a>
            </div>
          ) : null}

          <div className="pt-2 border-t border-yellow-200 dark:border-yellow-800">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Evaluated against {evaluation.candidateRunIds.length}{" "}
              implementations
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
