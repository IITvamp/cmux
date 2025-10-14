import { FloatingPane } from "@/components/floating-pane";
import { TitleBar } from "@/components/TitleBar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@cmux/convex/api";
import type { Doc } from "@cmux/convex/dataModel";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Lightbulb,
  Play,
  Plus,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_layout/$teamSlugOrId/brainstorm/")({
  component: BrainstormIndexPage,
});

function BrainstormIndexPage() {
  const { teamSlugOrId } = Route.useParams();
  const navigate = useNavigate();
  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);

  const sessionsQuery = useQuery(
    convexQuery(api.brainstorm.listSessions, { teamSlugOrId })
  );

  const activeSessions =
    sessionsQuery.data?.filter((s) => s.status !== "completed" && s.status !== "cancelled") ||
    [];
  const completedSessions =
    sessionsQuery.data?.filter((s) => s.status === "completed" || s.status === "cancelled") || [];

  return (
    <FloatingPane header={<TitleBar title="Brainstorm Sessions" />}>
      <div className="flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Lightbulb className="w-6 h-6 text-yellow-500" />
                Brainstorm Sessions
              </h1>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                Collaborate with AI to plan and execute complex tasks
              </p>
            </div>
            <Button
              onClick={() => setShowNewSessionDialog(true)}
              size="lg"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              New Session
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Active Sessions */}
          {activeSessions.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
                Active Sessions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeSessions.map((session) => (
                  <SessionCard
                    key={session._id}
                    session={session}
                    teamSlugOrId={teamSlugOrId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed Sessions */}
          {completedSessions.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
                Completed Sessions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedSessions.map((session) => (
                  <SessionCard
                    key={session._id}
                    session={session}
                    teamSlugOrId={teamSlugOrId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {sessionsQuery.data && sessionsQuery.data.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64">
              <Lightbulb className="w-16 h-16 text-neutral-300 dark:text-neutral-700 mb-4" />
              <h3 className="text-lg font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                No brainstorm sessions yet
              </h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center max-w-md mb-4">
                Start a brainstorm session to break down complex tasks into
                manageable subtasks with AI assistance
              </p>
              <Button onClick={() => setShowNewSessionDialog(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Create Your First Session
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* New Session Dialog */}
      {showNewSessionDialog && (
        <NewSessionDialog
          teamSlugOrId={teamSlugOrId}
          onClose={() => setShowNewSessionDialog(false)}
          onCreated={(sessionId) => {
            void navigate({
              to: "/$teamSlugOrId/brainstorm/$sessionId",
              params: { teamSlugOrId, sessionId },
            });
          }}
        />
      )}
    </FloatingPane>
  );
}

function SessionCard({
  session,
  teamSlugOrId,
}: {
  session: Doc<"brainstormSessions">;
  teamSlugOrId: string;
}) {
  const statusConfig = {
    planning: {
      label: "Planning",
      icon: <Clock className="w-4 h-4" />,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
    },
    ready: {
      label: "Ready",
      icon: <CheckCircle2 className="w-4 h-4" />,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-900/20",
    },
    in_progress: {
      label: "In Progress",
      icon: <Play className="w-4 h-4" />,
      color: "text-yellow-600 dark:text-yellow-400",
      bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
    },
    completed: {
      label: "Completed",
      icon: <CheckCircle2 className="w-4 h-4" />,
      color: "text-neutral-600 dark:text-neutral-400",
      bgColor: "bg-neutral-50 dark:bg-neutral-800",
    },
    cancelled: {
      label: "Cancelled",
      icon: <Clock className="w-4 h-4" />,
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-50 dark:bg-red-900/20",
    },
  }[session.status];

  return (
    <Link
      to="/$teamSlugOrId/brainstorm/$sessionId"
      params={{ teamSlugOrId, sessionId: session._id }}
    >
      <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-2">
            {session.title}
          </h3>
        </div>

        {session.description && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-3">
            {session.description}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${statusConfig.bgColor}`}
          >
            <span className={statusConfig.color}>{statusConfig.icon}</span>
            <span className={`text-xs font-medium ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
            <Calendar className="w-3 h-3" />
            <span>{new Date(session.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {session.projectFullName && (
          <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {session.projectFullName}
          </div>
        )}
      </Card>
    </Link>
  );
}

function NewSessionDialog({
  teamSlugOrId,
  onClose,
  onCreated,
}: {
  teamSlugOrId: string;
  onClose: () => void;
  onCreated: (sessionId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const createSession = useMutation(api.brainstorm.createSession);

  const handleCreate = async () => {
    if (!title.trim()) return;

    const sessionId = await createSession({
      teamSlugOrId,
      title: title.trim(),
      description: description.trim() || undefined,
    });

    onCreated(sessionId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
          Create New Brainstorm Session
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Implement user authentication system"
              className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you want to accomplish..."
              rows={3}
              className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!title.trim()}>
            Create Session
          </Button>
        </div>
      </Card>
    </div>
  );
}
