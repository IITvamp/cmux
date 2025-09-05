import { FloatingPane } from "@/components/floating-pane";
import { api } from "@cmux/convex/api";
import { type Doc, type Id } from "@cmux/convex/dataModel";
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQueries } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { Crown, GitPullRequest, GitPullRequestDraft } from "lucide-react";
import { useEffect, useMemo } from "react";

type InboxItem = {
  task: Doc<"tasks">;
  // Primary run to display (crowned if exists; otherwise latest completed)
  primaryRunId?: Id<"taskRuns">;
  // When the task became ready for review
  readyAt: number;
};

export const Route = createFileRoute("/_layout/$teamSlugOrId/inbox")({
  component: InboxPage,
  loader: async ({ params, context }) => {
    await context.queryClient.ensureQueryData(
      convexQuery(api.tasks.get, { teamSlugOrId: params.teamSlugOrId })
    );
  },
});

function InboxPage() {
  const { teamSlugOrId } = Route.useParams();
  const router = useRouter();

  const tasks = useSuspenseQuery(
    convexQuery(api.tasks.get, { teamSlugOrId })
  ).data;

  // Candidate finished tasks (ready when crown is not pending/in-progress)
  const finishedTasks = useMemo(() => {
    return (tasks || [])
      .filter((t) => t.isCompleted && t.isArchived !== true)
      .filter((t) => t.crownEvaluationError !== "pending_evaluation" && t.crownEvaluationError !== "in_progress");
  }, [tasks]);

  // Build per-task queries for runs and crown evaluation
  const runQueries = useMemo(() => {
    return finishedTasks.reduce(
      (acc, t) => ({
        ...acc,
        [t._id]: {
          query: api.taskRuns.getByTask,
          args: { teamSlugOrId, taskId: t._id },
        },
      }),
      {} as Record<Id<"tasks">, { query: typeof api.taskRuns.getByTask; args: { teamSlugOrId: string; taskId: Id<"tasks"> } }>
    );
  }, [finishedTasks, teamSlugOrId]);

  const evalQueries = useMemo(() => {
    return finishedTasks.reduce(
      (acc, t) => ({
        ...acc,
        [t._id]: {
          query: api.crown.getCrownEvaluation,
          args: { teamSlugOrId, taskId: t._id },
        },
      }),
      {} as Record<Id<"tasks">, { query: typeof api.crown.getCrownEvaluation; args: { teamSlugOrId: string; taskId: Id<"tasks"> } }>
    );
  }, [finishedTasks, teamSlugOrId]);

  const runsByTask = useQueries(runQueries as Parameters<typeof useQueries>[0]);
  const evalByTask = useQueries(evalQueries as Parameters<typeof useQueries>[0]);

  const inboxItems: InboxItem[] = useMemo(() => {
    return finishedTasks
      .map((task) => {
        const runs = (runsByTask[task._id] || []) as Doc<"taskRuns">[];
        const evaluation = evalByTask[task._id] as
          | (Doc<"crownEvaluations"> | null)
          | undefined;

        // Determine primary run (crowned if available, else latest completed)
        const crowned = runs.find((r) => r.isCrowned === true);
        const latestCompleted = runs
          .filter((r) => r.completedAt != null)
          .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))[0];

        // Determine when this task became ready
        const readyAt = (evaluation?.evaluatedAt ?? crowned?.completedAt ?? latestCompleted?.completedAt ?? task.updatedAt ?? task.createdAt ?? Date.now());

        const primaryRunId = (crowned?._id ?? latestCompleted?._id) as
          | Id<"taskRuns">
          | undefined;

        return {
          task,
          primaryRunId,
          readyAt,
        } satisfies InboxItem;
      })
      .sort((a, b) => b.readyAt - a.readyAt);
  }, [evalByTask, finishedTasks, runsByTask]);

  // Auto-select the newest item by navigating to its task page for detailed view
  const newest = inboxItems[0];
  useEffect(() => {
    if (!newest) return;
    // Preload detail route data subtly by touching the router; don't navigate away
    void router.invalidate();
  }, [newest, router]);

  return (
    <FloatingPane>
      <div className="flex h-full min-h-0">
        {/* Inbox list */}
        <aside className="w-[320px] border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shrink-0 overflow-y-auto">
          <header className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
            <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Inbox</h2>
            <p className="text-[12px] text-neutral-500 dark:text-neutral-400">Recently finished tasks</p>
          </header>
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {inboxItems.length === 0 ? (
              <li className="px-4 py-6 text-sm text-neutral-500 dark:text-neutral-400">
                No finished tasks yet
              </li>
            ) : (
              inboxItems.map(({ task, primaryRunId, readyAt }) => (
                <li key={task._id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <a
                    href={`/${teamSlugOrId}/task/${task._id}`}
                    className="block px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      {/* Crown indicator if crowned */}
                      {task.crownEvaluationError == null && (
                        <Crown
                          className="w-3.5 h-3.5 text-amber-500 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[13px] text-neutral-900 dark:text-neutral-100">
                            {task.pullRequestTitle || task.text}
                          </p>
                          {/* PR state chip if present */}
                          {task.mergeStatus === "pr_open" && (
                            <span className="inline-flex items-center gap-1 rounded-sm bg-green-50 dark:bg-green-900/30 px-1.5 py-[1px] text-[11px] font-medium text-green-700 dark:text-green-300">
                              <GitPullRequest className="w-3 h-3" /> Open
                            </span>
                          )}
                          {task.mergeStatus === "pr_draft" && (
                            <span className="inline-flex items-center gap-1 rounded-sm bg-neutral-100 dark:bg-neutral-800 px-1.5 py-[1px] text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                              <GitPullRequestDraft className="w-3 h-3" /> Draft
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[12px] text-neutral-500 dark:text-neutral-400 truncate">
                          {primaryRunId ? "Ready" : "Completed"} {formatDistanceToNow(new Date(readyAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </a>
                </li>
              ))
            )}
          </ul>
        </aside>

        {/* Detail panel placeholder */}
        <section className="flex-1 min-w-0 bg-white dark:bg-neutral-900">
          <div className="h-full flex items-center justify-center text-neutral-400 dark:text-neutral-500 text-sm">
            Select a task on the left to review
          </div>
        </section>
      </div>
    </FloatingPane>
  );
}
