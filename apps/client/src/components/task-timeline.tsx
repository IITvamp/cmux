import { type Doc, type Id } from "@cmux/convex/dataModel";
import { useUser } from "@stackframe/react";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  ArrowUp,
  CheckCircle2,
  Clock,
  Play,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";

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
};

interface TaskTimelineProps {
  task?: Doc<"tasks"> | null;
  taskRuns: TaskRunWithChildren[] | null;
  crownEvaluation?: {
    evaluatedAt?: number;
    winnerRunId?: Id<"taskRuns">;
    reason?: string;
  } | null;
  onComment?: (comment: string) => void;
}

export function TaskTimeline({
  task,
  taskRuns,
  crownEvaluation,
  onComment,
}: TaskTimelineProps) {
  const [comment, setComment] = useState("");
  const user = useUser();

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

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (comment.trim() && onComment) {
      onComment(comment.trim());
      setComment("");
    }
  };

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
            <Play className="size-2.5 text-blue-600 dark:text-blue-400" />
          </div>
        );
        content = (
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
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {agentName}
            </span>
            <span className="text-neutral-600 dark:text-neutral-400">
              {event.isCrowned ? " completed and won the crown" : " completed"}
            </span>
            <span className="text-neutral-500 dark:text-neutral-500 ml-1">
              {formatDistanceToNow(event.timestamp, { addSuffix: true })}
            </span>
            {event.summary && (
              <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 rounded-md p-3">
                {event.summary}
              </div>
            )}
            {event.crownReason && (
              <div className="mt-2 text-[13px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-md p-3">
                <Trophy className="inline size-3 mr-2" />
                {event.crownReason}
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
            {event.crownReason && (
              <div className="mt-2 text-[13px] text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-md p-3">
                {event.crownReason}
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
    <div className="space-y-4">
      {/* Prompt Message */}
      {task?.text && (
        <div className="mb-6">
          <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg px-4 py-3">
            <div className="flex items-start gap-2 mb-2">
              <img
                src={user?.profileImageUrl || ""}
                alt={user?.primaryEmail || "User"}
                className="size-5 rounded-full flex-shrink-0"
              />
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
                  {user?.displayName ||
                    user?.primaryEmail?.split("@")[0] ||
                    "User"}
                </span>
                {task.createdAt && (
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    {formatDistanceToNow(task.createdAt, { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>
            <div className="text-[15px] font-medium text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
              {task.text}
            </div>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-4">
          Activity
        </h3>

        {/* Timeline Events */}
        <div className="space-y-4">
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
      {/* Comment Box */}
      <div className="border-t border-neutral-200 dark:border-neutral-800 pt-6 mt-8">
        <form onSubmit={handleCommentSubmit}>
          <div className="relative">
            <TextareaAutosize
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Leave a comment..."
              className="w-full px-3 py-2 pr-20 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent resize-none"
              minRows={3}
              maxRows={10}
            />
            <div className="absolute bottom-2 pb-1.5 right-1.5">
              <button
                type="submit"
                disabled={!comment.trim()}
                className="flex items-center justify-center h-7 w-7 rounded-full border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-500 hover:text-neutral-700 hover:border-neutral-400 dark:hover:text-neutral-300 dark:hover:border-neutral-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Send comment"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
