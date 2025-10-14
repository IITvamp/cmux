import { FloatingPane } from "@/components/floating-pane";
import { TitleBar } from "@/components/TitleBar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@cmux/convex/api";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  MessageSquare,
  Play,
  Send,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Doc, Id } from "@cmux/convex/dataModel";

export const Route = createFileRoute(
  "/_layout/$teamSlugOrId/brainstorm/$sessionId"
)({
  component: BrainstormSessionPage,
});

function BrainstormSessionPage() {
  const { teamSlugOrId, sessionId } = Route.useParams();
  const [messageInput, setMessageInput] = useState("");
  const [showChat, setShowChat] = useState(true);

  const sessionQuery = useQuery(
    convexQuery(api.brainstorm.getSessionFull, {
      teamSlugOrId,
      sessionId: sessionId as Id<"brainstormSessions">,
    })
  );

  const addMessage = useMutation(api.brainstorm.addMessage);
  const updateSessionStatus = useMutation(api.brainstorm.updateSessionStatus);

  const sessionData = sessionQuery.data;

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;

    await addMessage({
      teamSlugOrId,
      sessionId: sessionId as Id<"brainstormSessions">,
      role: "user",
      content: messageInput.trim(),
    });

    setMessageInput("");

    // TODO: Trigger agent response via API
  };

  const handleStartExecution = async () => {
    await updateSessionStatus({
      teamSlugOrId,
      sessionId: sessionId as Id<"brainstormSessions">,
      status: "in_progress",
    });

    // TODO: Trigger actual task execution for subtasks
  };

  if (!sessionData) {
    return (
      <FloatingPane header={<TitleBar title="Brainstorm Session" />}>
        <div className="flex items-center justify-center h-screen">
          <div className="text-neutral-500">Loading...</div>
        </div>
      </FloatingPane>
    );
  }

  const { session, subtasks, dependencies, messages } = sessionData;

  return (
    <FloatingPane header={<TitleBar title={session.title} />}>
      <div className="flex h-screen">
        {/* Subtasks Board */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-neutral-200 dark:border-neutral-800">
          {/* Session Header */}
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                {session.title}
              </h1>
              <div className="flex items-center gap-2">
                <StatusBadge status={session.status} />
                {session.status === "ready" && (
                  <Button
                    onClick={handleStartExecution}
                    size="sm"
                    className="gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Start Execution
                  </Button>
                )}
              </div>
            </div>
            {session.description && (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {session.description}
              </p>
            )}
          </div>

          {/* Subtasks Sprint Board */}
          <div className="flex-1 overflow-auto p-4">
            <SubtasksBoard
              teamSlugOrId={teamSlugOrId}
              session={session}
              subtasks={subtasks}
              dependencies={dependencies}
            />
          </div>
        </div>

        {/* Chat Panel */}
        {showChat && (
          <div className="w-96 flex flex-col border-l border-neutral-200 dark:border-neutral-800">
            {/* Chat Header */}
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  Planning Chat
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowChat(false)}
                className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-auto p-4 space-y-4 bg-neutral-50 dark:bg-neutral-900">
              {messages.map((message) => (
                <ChatMessage key={message._id} message={message} />
              ))}
            </div>

            {/* Input */}
            {session.status === "planning" && (
              <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendMessage();
                      }
                    }}
                    placeholder="Ask about the plan or suggest changes..."
                    className="flex-1 px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Button onClick={handleSendMessage} size="sm">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </FloatingPane>
  );
}

function StatusBadge({ status }: { status: Doc<"brainstormSessions">["status"] }) {
  const config = {
    planning: {
      label: "Planning",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    },
    ready: {
      label: "Ready",
      className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    },
    in_progress: {
      label: "In Progress",
      className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    },
    completed: {
      label: "Completed",
      className: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400",
    },
    cancelled: {
      label: "Cancelled",
      className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    },
  }[status];

  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded-md ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function ChatMessage({ message }: { message: Doc<"brainstormMessages"> }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="text-center text-xs text-neutral-500 dark:text-neutral-400 italic">
        {message.content}
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700"
        }`}
      >
        {!isUser && message.agentName && (
          <div className="text-xs font-medium mb-1 text-neutral-500 dark:text-neutral-400">
            {message.agentName}
          </div>
        )}
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  );
}

function SubtasksBoard({
  teamSlugOrId,
  session,
  subtasks,
  dependencies,
}: {
  teamSlugOrId: string;
  session: Doc<"brainstormSessions">;
  subtasks: Doc<"brainstormSubtasks">[];
  dependencies: Doc<"brainstormDependencies">[];
}) {
  const columns = [
    { id: "pending", label: "To Do", statuses: ["pending"] },
    { id: "ready", label: "Ready", statuses: ["ready", "blocked"] },
    { id: "in_progress", label: "In Progress", statuses: ["in_progress"] },
    { id: "completed", label: "Done", statuses: ["completed", "failed"] },
  ] as const;

  const subtasksByColumn = useMemo(() => {
    const map: Record<string, Doc<"brainstormSubtasks">[]> = {};
    for (const col of columns) {
      map[col.id] = subtasks.filter((st) => col.statuses.includes(st.status));
    }
    return map;
  }, [subtasks]);

  return (
    <div className="grid grid-cols-4 gap-4 h-full">
      {columns.map((col) => (
        <div
          key={col.id}
          className="flex flex-col bg-neutral-50 dark:bg-neutral-900 rounded-lg p-3 min-h-0"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              {col.label}
            </h3>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {subtasksByColumn[col.id].length}
            </span>
          </div>
          <div className="flex-1 overflow-auto space-y-2">
            {subtasksByColumn[col.id].map((subtask) => (
              <SubtaskCard
                key={subtask._id}
                subtask={subtask}
                dependencies={dependencies}
                teamSlugOrId={teamSlugOrId}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SubtaskCard({
  subtask,
  dependencies,
  teamSlugOrId,
}: {
  subtask: Doc<"brainstormSubtasks">;
  dependencies: Doc<"brainstormDependencies">[];
  teamSlugOrId: string;
}) {
  const dependsOn = dependencies.filter((d) => d.subtaskId === subtask._id);
  const blockedBy = dependencies.filter((d) => d.dependsOnSubtaskId === subtask._id);

  const statusIcon = {
    pending: <Circle className="w-4 h-4 text-neutral-400" />,
    blocked: <X className="w-4 h-4 text-red-500" />,
    ready: <CheckCircle2 className="w-4 h-4 text-green-500" />,
    in_progress: <Clock className="w-4 h-4 text-yellow-500 animate-pulse" />,
    completed: <CheckCircle2 className="w-4 h-4 text-green-600" />,
    failed: <X className="w-4 h-4 text-red-600" />,
  }[subtask.status];

  return (
    <Card className="p-3 hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-start gap-2 mb-2">
        {statusIcon}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 line-clamp-2">
            {subtask.title}
          </h4>
        </div>
      </div>

      {subtask.description && (
        <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-2">
          {subtask.description}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
        {subtask.estimatedMinutes && (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{subtask.estimatedMinutes}m</span>
          </div>
        )}

        {(dependsOn.length > 0 || blockedBy.length > 0) && (
          <div className="flex items-center gap-1">
            <ArrowRight className="w-3 h-3" />
            <span>
              {dependsOn.length}↓ {blockedBy.length}↑
            </span>
          </div>
        )}
      </div>

      {subtask.assignedAgents && subtask.assignedAgents.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {subtask.assignedAgents.map((agent) => (
            <span
              key={agent}
              className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded"
            >
              {agent.split("/")[1] || agent}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
