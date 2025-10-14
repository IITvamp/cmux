import { api } from "@cmux/convex/api";
import { type Doc, type Id } from "@cmux/convex/dataModel";
import type { RunEnvironmentSummary } from "@/types/task";
import { useUser } from "@stackframe/react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Play,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react";
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CmuxLogoMark from "./logo/cmux-logo-mark";
import { TaskMessage } from "./task-message";

interface TimelineEvent {
  id: string;
  type:
    | "task_created"
    | "run_started"
    | "run_completed"
    | "run_failed"
    | "crown_evaluation";
  timestamp: number;
  runId?: Id<"taskRuns">;
  agentName?: string;
  status?: "pending" | "running" | "completed" | "failed";
  exitCode?: number;
  isCrowned?: boolean;
  crownReason?: string;
  summary?: string;
  userId?: string;
}

type TaskRunWithChildren = Doc<"taskRuns"> & {
  children?: TaskRunWithChildren[];
  environment?: RunEnvironmentSummary | null;
};

interface TaskTimelineProps {
  task?: Doc<"tasks"> | null;
  taskRuns: TaskRunWithChildren[] | null;
  crownEvaluation?: {
    evaluatedAt?: number;
    winnerRunId?: Id<"taskRuns">;
    reason?: string;
  } | null;
}

export function TaskTimeline({
  task,
  taskRuns,
  crownEvaluation,
}: TaskTimelineProps) {
  const user = useUser();
  const params = useParams({ from: "/_layout/$teamSlugOrId/task/$taskId" });
  const taskComments = useQuery(api.taskComments.listByTask, {
    teamSlugOrId: params.teamSlugOrId,
    taskId: params.taskId as Id<"tasks">,
  });

  const events = useMemo(() => {
    const timelineEvents: TimelineEvent[] = [];

    // Add task creation event
    if (task?.createdAt) {
      timelineEvents.push({
        id: "task-created",
        type: "task_created",
        timestamp: task.createdAt,
        userId: task.userId,
      });
    }

    if (!taskRuns) return timelineEvents;

    // Flatten the tree structure to get all runs
    const flattenRuns = (runs: TaskRunWithChildren[]): Doc<"taskRuns">[] => {
      const result: Doc<"taskRuns">[] = [];
      runs.forEach((run) => {
        result.push(run);
        if (run.children?.length) {
          result.push(...flattenRuns(run.children));
        }
      });
      return result;
    };

    const allRuns = flattenRuns(taskRuns);

    // Add run events
    allRuns.forEach((run) => {
      // Run started event
      timelineEvents.push({
        id: `${run._id}-start`,
        type: "run_started",
        timestamp: run.createdAt,
        runId: run._id,
        agentName: run.agentName,
        status: run.status,
      });

      // Run completed/failed event
      if (run.completedAt) {
        timelineEvents.push({
          id: `${run._id}-end`,
          type: run.status === "failed" ? "run_failed" : "run_completed",
          timestamp: run.completedAt,
          runId: run._id,
          agentName: run.agentName,
          status: run.status,
          exitCode: run.exitCode,
          summary: run.summary,
          isCrowned: run.isCrowned,
          crownReason: run.crownReason,
        });
      }
    });

    // Add crown evaluation event if exists
    if (crownEvaluation?.evaluatedAt) {
      timelineEvents.push({
        id: "crown-evaluation",
        type: "crown_evaluation",
        timestamp: crownEvaluation.evaluatedAt,
        runId: crownEvaluation.winnerRunId,
        crownReason: crownEvaluation.reason,
      });
    }

    // Sort by timestamp
    return timelineEvents.sort((a, b) => a.timestamp - b.timestamp);
  }, [task, taskRuns, crownEvaluation]);

  if (!events.length && !task) {
    return (
      <div className="flex items-center justify-center py-12 text-neutral-500">
        <Clock className="h-5 w-5 mr-2" />
        <span className="text-sm">No activity yet</span>
      </div>
    );
  }

  const ActivityEvent = ({ event }: { event: TimelineEvent }) => {
    const agentName = event.agentName || "Agent";

    let icon;
    let content;

    switch (event.type) {
      case "task_created":
        icon = (
          <img
            src={user?.profileImageUrl || ""}
            alt={user?.primaryEmail || "User"}
            className="size-4 rounded-full"
          />
        );
        content = (
          <>
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {user?.displayName || user?.primaryEmail || "User"}
            </span>
            <span className="text-neutral-600 dark:text-neutral-400">
              {" "}
              created the task
            </span>
            <span className="text-neutral-500 dark:text-neutral-500 ml-1">
              {formatDistanceToNow(event.timestamp, { addSuffix: true })}
            </span>
          </>
        );
        break;
      case "run_started":
        icon = (
          <div className="size-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Play className="size-[9px] text-blue-600 dark:text-blue-400" />
          </div>
        );
        content = event.runId ? (
          <Link
            to="/$teamSlugOrId/task/$taskId/run/$runId"
            params={{
              teamSlugOrId: params.teamSlugOrId,
              taskId: params.taskId,
              runId: event.runId,
              taskRunId: event.runId,
            }}
            className="hover:underline inline"
          >
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {agentName}
            </span>
            <span className="text-neutral-600 dark:text-neutral-400">
              {" "}
              started working
            </span>
            <span className="text-neutral-500 dark:text-neutral-500 ml-1">
              {formatDistanceToNow(event.timestamp, { addSuffix: true })}
            </span>
          </Link>
        ) : (
          <>
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {agentName}
            </span>
            <span className="text-neutral-600 dark:text-neutral-400">
              {" "}
              started working
            </span>
            <span className="text-neutral-500 dark:text-neutral-500 ml-1">
              {formatDistanceToNow(event.timestamp, { addSuffix: true })}
            </span>
          </>
        );
        break;
      case "run_completed":
        icon = event.isCrowned ? (
          <div className="size-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Trophy className="size-2.5 text-amber-600 dark:text-amber-400" />
          </div>
        ) : (
          <div className="size-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle2 className="size-2.5 text-green-600 dark:text-green-400" />
          </div>
        );
        content = (
          <>
            {event.runId ? (
              <Link
                to="/$teamSlugOrId/task/$taskId/run/$runId"
                params={{
                  teamSlugOrId: params.teamSlugOrId,
                  taskId: params.taskId,
                  runId: event.runId,
                  taskRunId: event.runId,
                }}
                className="hover:underline inline"
              >
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {agentName}
                </span>
                <span className="text-neutral-600 dark:text-neutral-400">
                  {event.isCrowned
                    ? " completed and won the crown"
                    : " completed"}
                </span>
                <span className="text-neutral-500 dark:text-neutral-500 ml-1">
                  {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                </span>
              </Link>
            ) : (
              <>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {agentName}
                </span>
                <span className="text-neutral-600 dark:text-neutral-400">
                  {event.isCrowned
                    ? " completed and won the crown"
                    : " completed"}
                </span>
                <span className="text-neutral-500 dark:text-neutral-500 ml-1">
                  {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                </span>
              </>
            )}
            {event.summary && (
              <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 rounded-md p-3">
                {event.summary}
              </div>
            )}
            {event.crownReason && (
              <div className="mt-2 text-[13px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-md p-3">
                <Trophy className="inline size-3 mr-2" />
                <span className="prose prose-neutral dark:prose-invert prose-sm max-w-none
                  prose-p:my-1.5 prose-p:leading-relaxed prose-p:inline
                  prose-headings:mt-4 prose-headings:mb-3 prose-headings:font-semibold
                  prose-h1:text-xl prose-h1:mt-5 prose-h1:mb-3
                  prose-h2:text-lg prose-h2:mt-4 prose-h2:mb-2.5
                  prose-h3:text-base prose-h3:mt-3.5 prose-h3:mb-2
                  prose-ul:my-2 prose-ul:list-disc prose-ul:pl-5
                  prose-ol:my-2 prose-ol:list-decimal prose-ol:pl-5
                  prose-li:my-0.5
                  prose-blockquote:border-l-4 prose-blockquote:border-amber-300 dark:prose-blockquote:border-amber-600
                  prose-blockquote:pl-4 prose-blockquote:py-0.5 prose-blockquote:my-2
                  prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:bg-amber-100 dark:prose-code:bg-amber-800
                  prose-code:text-[13px] prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
                  prose-pre:bg-amber-900 dark:prose-pre:bg-amber-800 prose-pre:text-amber-100
                  prose-pre:p-3 prose-pre:rounded-md prose-pre:my-2 prose-pre:overflow-x-auto
                  prose-a:text-amber-800 dark:prose-a:text-amber-300 prose-a:underline prose-a:break-words
                  prose-table:my-2 prose-table:border prose-table:border-amber-300 dark:prose-table:border-amber-600
                  prose-th:p-2 prose-th:bg-amber-100 dark:prose-th:bg-amber-800
                  prose-td:p-2 prose-td:border prose-td:border-amber-300 dark:prose-td:border-amber-600
                  prose-hr:my-3 prose-hr:border-amber-300 dark:prose-hr:border-amber-600
                  prose-strong:font-semibold prose-strong:text-amber-900 dark:prose-strong:text-amber-100">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {event.crownReason}
                  </ReactMarkdown>
                </span>
              </div>
            )}
          </>
        );
        break;
      case "run_failed":
        icon = (
          <div className="size-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <XCircle className="size-2.5 text-red-600 dark:text-red-400" />
          </div>
        );
        content = (
          <>
            {event.runId ? (
              <Link
                to="/$teamSlugOrId/task/$taskId/run/$runId"
                params={{
                  teamSlugOrId: params.teamSlugOrId,
                  taskId: params.taskId,
                  runId: event.runId,
                  taskRunId: event.runId,
                }}
                className="hover:underline inline"
              >
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {agentName}
                </span>
                <span className="text-neutral-600 dark:text-neutral-400">
                  {" "}
                  failed
                </span>
                <span className="text-neutral-500 dark:text-neutral-500 ml-1">
                  {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                </span>
              </Link>
            ) : (
              <>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {agentName}
                </span>
                <span className="text-neutral-600 dark:text-neutral-400">
                  {" "}
                  failed
                </span>
                <span className="text-neutral-500 dark:text-neutral-500 ml-1">
                  {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                </span>
              </>
            )}
            {event.exitCode !== undefined && event.exitCode !== 0 && (
              <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                Exit code: {event.exitCode}
              </div>
            )}
          </>
        );
        break;
      case "crown_evaluation":
        icon = (
          <div className="size-4 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Sparkles className="size-2.5 text-purple-600 dark:text-purple-400" />
          </div>
        );
        content = (
          <>
            {event.runId ? (
              <Link
                to="/$teamSlugOrId/task/$taskId/run/$runId"
                params={{
                  teamSlugOrId: params.teamSlugOrId,
                  taskId: params.taskId,
                  runId: event.runId,
                  taskRunId: event.runId,
                }}
                className="hover:underline inline"
              >
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  Crown evaluation
                </span>
                <span className="text-neutral-600 dark:text-neutral-400">
                  {" "}
                  completed
                </span>
                <span className="text-neutral-500 dark:text-neutral-500 ml-1">
                  {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                </span>
              </Link>
            ) : (
              <>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  Crown evaluation
                </span>
                <span className="text-neutral-600 dark:text-neutral-400">
                  {" "}
                  completed
                </span>
                <span className="text-neutral-500 dark:text-neutral-500 ml-1">
                  {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                </span>
              </>
            )}
            {event.crownReason && (
              <div className="mt-2 text-[13px] text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-md p-3
                prose prose-neutral dark:prose-invert prose-sm max-w-none
                prose-p:my-1.5 prose-p:leading-relaxed
                prose-headings:mt-4 prose-headings:mb-3 prose-headings:font-semibold
                prose-h1:text-xl prose-h1:mt-5 prose-h1:mb-3
                prose-h2:text-lg prose-h2:mt-4 prose-h2:mb-2.5
                prose-h3:text-base prose-h3:mt-3.5 prose-h3:mb-2
                prose-ul:my-2 prose-ul:list-disc prose-ul:pl-5
                prose-ol:my-2 prose-ol:list-decimal prose-ol:pl-5
                prose-li:my-0.5
                prose-blockquote:border-l-4 prose-blockquote:border-purple-300 dark:prose-blockquote:border-purple-600
                prose-blockquote:pl-4 prose-blockquote:py-0.5 prose-blockquote:my-2
                prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:bg-purple-100 dark:prose-code:bg-purple-800
                prose-code:text-[13px] prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
                prose-pre:bg-purple-900 dark:prose-pre:bg-purple-800 prose-pre:text-purple-100
                prose-pre:p-3 prose-pre:rounded-md prose-pre:my-2 prose-pre:overflow-x-auto
                prose-a:text-purple-800 dark:prose-a:text-purple-300 prose-a:underline prose-a:break-words
                prose-table:my-2 prose-table:border prose-table:border-purple-300 dark:prose-table:border-purple-600
                prose-th:p-2 prose-th:bg-purple-100 dark:prose-th:bg-purple-800
                prose-td:p-2 prose-td:border prose-td:border-purple-300 dark:prose-td:border-purple-600
                prose-hr:my-3 prose-hr:border-purple-300 dark:prose-hr:border-purple-600
                prose-strong:font-semibold prose-strong:text-purple-900 dark:prose-strong:text-purple-100">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {event.crownReason}
                </ReactMarkdown>
              </div>
            )}
          </>
        );
        break;
      default:
        icon = (
          <div className="size-4 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
            <AlertCircle className="size-2.5 text-neutral-600 dark:text-neutral-400" />
          </div>
        );
        content = (
          <>
            <span className="text-neutral-600 dark:text-neutral-400">
              Unknown event
            </span>
            <span className="text-neutral-500 dark:text-neutral-500 ml-1">
              {formatDistanceToNow(event.timestamp, { addSuffix: true })}
            </span>
          </>
        );
    }

    return (
      <>
        <div className="shrink-0 flex items-start justify-center">{icon}</div>
        <div className="flex-1 min-w-0 flex items-center">
          <div className="text-xs">
            <div>{content}</div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="space-y-2">
      {/* Prompt Message */}
      {task?.text && (
        <TaskMessage
          authorName={
            user?.displayName || user?.primaryEmail?.split("@")[0] || "User"
          }
          authorImageUrl={user?.profileImageUrl || ""}
          authorAlt={user?.primaryEmail || "User"}
          timestamp={task.createdAt}
          content={task.text}
        />
      )}

      <div>
        {/* Timeline Events */}
        <div className="space-y-4 pl-5">
          {events.map((event, index) => (
            <div key={event.id} className="relative flex gap-3">
              <ActivityEvent event={event} />
              {index < events.length - 1 && (
                <div className="absolute left-1.5 top-5 -bottom-3 w-px transform translate-x-[1px] bg-neutral-200 dark:bg-neutral-800" />
              )}
            </div>
          ))}
        </div>
      </div>
      {/* Task Comments (chronological) */}
      {taskComments && taskComments.length > 0 ? (
        <div className="space-y-2 pt-2">
          {taskComments.map((c) => (
            <TaskMessage
              key={c._id}
              authorName={
                c.userId === "cmux"
                  ? "cmux"
                  : user?.displayName ||
                    user?.primaryEmail?.split("@")[0] ||
                    "User"
              }
              avatar={
                c.userId === "cmux" ? (
                  <CmuxLogoMark height={20} label="cmux" />
                ) : undefined
              }
              authorImageUrl={
                c.userId === "cmux" ? undefined : user?.profileImageUrl || ""
              }
              authorAlt={
                c.userId === "cmux" ? "cmux" : user?.primaryEmail || "User"
              }
              timestamp={c.createdAt}
              content={c.content}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
