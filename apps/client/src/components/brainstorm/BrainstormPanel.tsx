import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { TaskMessage } from "@/components/task-message";
import {
  BRAINSTORM_STATUS_OPTIONS,
  SUBTASK_STATUS_OPTIONS,
  type AuthorType,
  type BrainstormDetails,
} from "@/types/brainstorm";
import { api } from "@cmux/convex/api";
import type { Doc, Id } from "@cmux/convex/dataModel";
import { useMutation, useQuery } from "convex/react";
import clsx from "clsx";
import {
  Check,
  Loader2,
  MessageCircle,
  PenSquare,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useUser } from "@stackframe/react";

interface BrainstormPanelProps {
  teamSlugOrId: string;
  taskId: Id<"tasks">;
}

type SubtaskWithDependencies = BrainstormDetails["subtasks"][number];

export function BrainstormPanel({ teamSlugOrId, taskId }: BrainstormPanelProps) {
  const brainQuery = useQuery(api.taskBrainstorms.getByTask, {
    teamSlugOrId,
    taskId,
  });
  const startBrainstorm = useMutation(api.taskBrainstorms.startForTask);
  const updateBrainstorm = useMutation(api.taskBrainstorms.update);

  const [objectiveDraft, setObjectiveDraft] = useState<string>("");
  const [starting, setStarting] = useState(false);
  const [brainstormTitle, setBrainstormTitle] = useState<string>("");

  useEffect(() => {
    if (brainQuery === undefined) {
      return;
    }
    setObjectiveDraft(brainQuery?.objective ?? "");
    setBrainstormTitle(brainQuery?.title ?? "");
  }, [brainQuery]);

  const handleStart = async () => {
    if (starting) {
      return;
    }
    try {
      setStarting(true);
      await startBrainstorm({
        teamSlugOrId,
        taskId,
        objective: objectiveDraft.trim() || undefined,
        title: brainstormTitle.trim() || undefined,
        status: "active",
      });
      toast.success("Brainstorm started");
    } catch (error) {
      console.error(error);
      toast.error("Failed to start brainstorm");
    } finally {
      setStarting(false);
    }
  };

  const handleStatusChange = async (
    nextStatus: Doc<"taskBrainstorms">["status"],
  ) => {
    if (!brainQuery) {
      return;
    }
    try {
      await updateBrainstorm({
        teamSlugOrId,
        brainstormId: brainQuery._id,
        status: nextStatus,
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to update status");
    }
  };

  const handleObjectiveBlur = async () => {
    if (!brainQuery) {
      return;
    }
    const trimmed = objectiveDraft.trim();
    const original = brainQuery.objective ?? "";
    if (trimmed === original.trim()) {
      return;
    }
    try {
      await updateBrainstorm({
        teamSlugOrId,
        brainstormId: brainQuery._id,
        objective: trimmed.length > 0 ? trimmed : null,
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to update objective");
    }
  };

  const handleTitleBlur = async () => {
    if (!brainQuery) {
      return;
    }
    const trimmed = brainstormTitle.trim();
    const original = brainQuery.title ?? "";
    if (trimmed === original.trim()) {
      return;
    }
    try {
      await updateBrainstorm({
        teamSlugOrId,
        brainstormId: brainQuery._id,
        title: trimmed.length > 0 ? trimmed : null,
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to update title");
    }
  };

  if (brainQuery === undefined) {
    return (
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-6 py-10">
        <div className="flex items-center justify-center gap-2 text-neutral-500 text-sm select-none">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading brainstorm...
        </div>
      </div>
    );
  }

  if (brainQuery === null) {
    return (
      <div className="rounded-lg border border-dashed border-blue-300 dark:border-blue-500/60 bg-blue-50/40 dark:bg-blue-500/10 px-8 py-10">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-300 px-3 py-1 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            Brainstorm mode
          </div>
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
            Start a brainstorm to break this task into an instant sprint
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            Collaborate with your agents to outline subtasks, capture dependencies, and assign agents before kicking off parallel runs.
          </p>
          <div className="grid gap-3 text-left">
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Brainstorm title
            </label>
            <input
              value={brainstormTitle}
              onChange={(event) => setBrainstormTitle(event.target.value)}
              placeholder="e.g. Sprint 0 planning"
              className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
            />
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Objective
            </label>
            <textarea
              value={objectiveDraft}
              onChange={(event) => setObjectiveDraft(event.target.value)}
              rows={3}
              placeholder="List what you want the brainstorm to explore"
              className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
            />
          </div>
          <div className="flex justify-center">
            <Button onClick={handleStart} disabled={starting} className="px-5">
              {starting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Start Brainstorm
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-6 py-6 space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-blue-500" />
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              Brainstorm
            </h2>
            <span
              className={clsx(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                brainQuery.status === "complete"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200"
                  : brainQuery.status === "active"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
                    : "bg-neutral-200 text-neutral-700 dark:bg-neutral-700/60 dark:text-neutral-200",
              )}
            >
              {brainQuery.status}
            </span>
          </div>
          <div className="space-y-2">
            <input
              value={brainstormTitle}
              onChange={(event) => setBrainstormTitle(event.target.value)}
              onBlur={handleTitleBlur}
              placeholder="Name this brainstorm"
              className="w-full rounded-md border border-transparent bg-neutral-100 dark:bg-neutral-800 px-3 py-2 text-sm font-medium text-neutral-900 dark:text-neutral-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <textarea
              value={objectiveDraft}
              onChange={(event) => setObjectiveDraft(event.target.value)}
              onBlur={handleObjectiveBlur}
              rows={3}
              placeholder="Summarize the overall approach or outcomes you expect from this brainstorm"
              className="w-full rounded-md border border-transparent bg-neutral-100 dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-1.5 text-sm text-neutral-900 dark:text-neutral-50 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            value={brainQuery.status}
            onChange={(event) =>
              handleStatusChange(event.target.value as Doc<"taskBrainstorms">["status"])
            }
          >
            {BRAINSTORM_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[ minmax(0,0.55fr) minmax(0,0.45fr) ]">
        <BrainstormConversation teamSlugOrId={teamSlugOrId} brainstorm={brainQuery} />
        <BrainstormSubtaskTable teamSlugOrId={teamSlugOrId} brainstorm={brainQuery} />
      </div>
    </div>
  );
}

function BrainstormConversation({
  teamSlugOrId,
  brainstorm,
}: {
  teamSlugOrId: string;
  brainstorm: BrainstormDetails;
}) {
  const addMessage = useMutation(api.taskBrainstorms.addMessage);
  const user = useUser();
  const [content, setContent] = useState("");
  const [authorType, setAuthorType] = useState<AuthorType>("user");
  const [agentName, setAgentName] = useState("Planning Agent");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setAuthorType("user");
    setAgentName("Planning Agent");
  }, [brainstorm._id]);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      return;
    }
    try {
      setIsSubmitting(true);
      await addMessage({
        teamSlugOrId,
        brainstormId: brainstorm._id,
        authorType,
        content: trimmed,
        agentName: authorType === "agent" ? agentName.trim() : undefined,
      });
      setContent("");
      if (authorType === "agent") {
        setAgentName((prev) => prev || "Planning Agent");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to add message");
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedMessages = useMemo(
    () => [...brainstorm.messages].sort((a, b) => a.createdAt - b.createdAt),
    [brainstorm.messages],
  );

  return (
    <section className="flex flex-col rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/60">
      <header className="flex items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-700 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-200">
          <PenSquare className="h-4 w-4" />
          Conversation
        </div>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {sortedMessages.length} message{sortedMessages.length === 1 ? "" : "s"}
        </span>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {sortedMessages.length === 0 ? (
          <div className="text-sm text-neutral-500 dark:text-neutral-400 select-none">
            No messages yet. Start the brainstorm by outlining the approach or ask an agent to propose a plan.
          </div>
        ) : (
          sortedMessages.map((message) => (
            <TaskMessage
              key={message._id}
              authorName={resolveAuthorName(message, user || undefined)}
              content={message.content}
              timestamp={message.createdAt}
              avatar={renderAvatarForMessage(message)}
            />
          ))
        )}
      </div>
      <footer className="border-t border-neutral-200 dark:border-neutral-700 px-4 py-3 space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
          <span>Compose as:</span>
          <button
            type="button"
            onClick={() => setAuthorType("user")}
            className={clsx(
              "rounded-full border px-2 py-1",
              authorType === "user"
                ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-300"
                : "border-transparent bg-neutral-200/60 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
            )}
          >
            Me
          </button>
          <button
            type="button"
            onClick={() => setAuthorType("agent")}
            className={clsx(
              "rounded-full border px-2 py-1",
              authorType === "agent"
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                : "border-transparent bg-neutral-200/60 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
            )}
          >
            Agent
          </button>
        </div>
        {authorType === "agent" && (
          <input
            value={agentName}
            onChange={(event) => setAgentName(event.target.value)}
            placeholder="Agent name"
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
          />
        )}
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={3}
          placeholder="Share context, propose a plan, or summarize agent ideas"
          className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
        />
        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || content.trim().length === 0}
            size="sm"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Post"
            )}
          </Button>
        </div>
      </footer>
    </section>
  );
}

function BrainstormSubtaskTable({
  teamSlugOrId,
  brainstorm,
}: {
  teamSlugOrId: string;
  brainstorm: BrainstormDetails;
}) {
  const createSubtask = useMutation(api.taskBrainstorms.createSubtask);
  const updateSubtask = useMutation(api.taskBrainstorms.updateSubtask);
  const deleteSubtask = useMutation(api.taskBrainstorms.deleteSubtask);
  const setDependencies = useMutation(
    api.taskBrainstorms.setSubtaskDependencies,
  );

  const [newTitle, setNewTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    const trimmed = newTitle.trim();
    if (trimmed.length === 0) {
      return;
    }
    try {
      setIsCreating(true);
      await createSubtask({
        teamSlugOrId,
        brainstormId: brainstorm._id,
        title: trimmed,
        status: "planned",
      });
      setNewTitle("");
    } catch (error) {
      console.error(error);
      toast.error("Failed to create subtask");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <section className="flex flex-col rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-200">
          <Sparkles className="h-4 w-4" />
          Subtasks sprint
        </div>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {brainstorm.subtasks.length} planned
        </span>
      </header>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700 text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Title</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">Agents</th>
              <th className="px-4 py-2 text-left font-medium">Prerequisites</th>
              <th className="px-4 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {brainstorm.subtasks.map((subtask) => (
              <BrainstormSubtaskRow
                key={subtask._id}
                teamSlugOrId={teamSlugOrId}
                subtask={subtask}
                allSubtasks={brainstorm.subtasks}
                updateSubtask={updateSubtask}
                deleteSubtask={deleteSubtask}
                setDependencies={setDependencies}
              />
            ))}
          </tbody>
        </table>
      </div>
      <footer className="border-t border-neutral-200 dark:border-neutral-700 px-4 py-3 space-y-3">
        <div className="flex items-center gap-3">
          <input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="Add a new subtask"
            className="flex-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCreate}
            disabled={isCreating || newTitle.trim().length === 0}
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Use comma-separated agent names to assign multiple agents to the same subtask. Dependencies help you visualize prerequisite order when running agents.
        </p>
      </footer>
    </section>
  );
}

function BrainstormSubtaskRow({
  teamSlugOrId,
  subtask,
  allSubtasks,
  updateSubtask,
  deleteSubtask,
  setDependencies,
}: {
  teamSlugOrId: string;
  subtask: SubtaskWithDependencies;
  allSubtasks: SubtaskWithDependencies[];
  updateSubtask: ReturnType<
    typeof useMutation<typeof api.taskBrainstorms.updateSubtask>
  >;
  deleteSubtask: ReturnType<
    typeof useMutation<typeof api.taskBrainstorms.deleteSubtask>
  >;
  setDependencies: ReturnType<
    typeof useMutation<typeof api.taskBrainstorms.setSubtaskDependencies>
  >;
}) {
  const [title, setTitle] = useState(subtask.title);
  const [agents, setAgents] = useState(
    (subtask.assignedAgentNames ?? []).join(", "),
  );
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isSavingAgents, setIsSavingAgents] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    setTitle(subtask.title);
    setAgents((subtask.assignedAgentNames ?? []).join(", "));
  }, [subtask.title, subtask.assignedAgentNames]);

  const handleTitleBlur = async () => {
    const trimmed = title.trim();
    if (trimmed.length === 0 || trimmed === subtask.title.trim()) {
      setTitle(subtask.title);
      return;
    }
    try {
      setIsSavingTitle(true);
      await updateSubtask({
        teamSlugOrId,
        subtaskId: subtask._id,
        title: trimmed,
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to update title");
      setTitle(subtask.title);
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleAgentsBlur = async () => {
    const trimmed = agents.trim();
    const parsed =
      trimmed.length === 0
        ? []
        : trimmed
            .split(",")
            .map((name) => name.trim())
            .filter((name) => name.length > 0);
    const existing = subtask.assignedAgentNames ?? [];
    if (
      parsed.length === existing.length &&
      parsed.every((value, index) => value === existing[index])
    ) {
      return;
    }
    try {
      setIsSavingAgents(true);
      await updateSubtask({
        teamSlugOrId,
        subtaskId: subtask._id,
        assignedAgentNames: parsed,
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to update agents");
      setAgents(existing.join(", "));
    } finally {
      setIsSavingAgents(false);
    }
  };

  const handleStatusChange = async (
    status: Doc<"taskBrainstormSubtasks">["status"],
  ) => {
    try {
      await updateSubtask({
        teamSlugOrId,
        subtaskId: subtask._id,
        status,
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async () => {
    try {
      setRemoving(true);
      await deleteSubtask({
        teamSlugOrId,
        subtaskId: subtask._id,
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete subtask");
    } finally {
      setRemoving(false);
    }
  };

  const dependencyOptions = useMemo(
    () =>
      allSubtasks.filter((candidate) => candidate._id !== subtask._id),
    [allSubtasks, subtask._id],
  );

  const handleDependenciesChange = async (
    nextDependencies: Id<"taskBrainstormSubtasks">[],
  ) => {
    try {
      await setDependencies({
        teamSlugOrId,
        subtaskId: subtask._id,
        dependsOn: nextDependencies,
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to update prerequisites");
    }
  };

  return (
    <tr className="bg-white dark:bg-neutral-900">
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={handleTitleBlur}
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
          />
          {isSavingTitle && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <select
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
          value={subtask.status}
          onChange={(event) =>
            handleStatusChange(
              event.target.value as Doc<"taskBrainstormSubtasks">["status"],
            )
          }
        >
          {SUBTASK_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-2">
          <input
            value={agents}
            onChange={(event) => setAgents(event.target.value)}
            onBlur={handleAgentsBlur}
            placeholder="Add agents"
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
          />
          {isSavingAgents && (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          )}
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <DependenciesDropdown
          dependencyIds={subtask.dependencyIds}
          options={dependencyOptions}
          onChange={handleDependenciesChange}
        />
      </td>
      <td className="px-4 py-3 align-top text-right">
        <button
          type="button"
          onClick={handleDelete}
          disabled={removing}
          className="inline-flex items-center justify-center rounded-md border border-transparent bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-300 px-2 py-1 text-xs font-medium hover:bg-red-200 dark:hover:bg-red-500/20"
        >
          {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      </td>
    </tr>
  );
}

function DependenciesDropdown({
  dependencyIds,
  options,
  onChange,
}: {
  dependencyIds: Id<"taskBrainstormSubtasks">[];
  options: SubtaskWithDependencies[];
  onChange: (next: Id<"taskBrainstormSubtasks">[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const toggleOption = (
    candidate: Id<"taskBrainstormSubtasks">,
    checked: boolean,
  ) => {
    const nextSet = new Set(dependencyIds);
    if (checked) {
      nextSet.add(candidate);
    } else {
      nextSet.delete(candidate);
    }
    onChange(Array.from(nextSet));
  };

  const dependencyLabels = dependencyIds
    .map((id) => options.find((option) => option._id === id)?.title)
    .filter((name): name is string => Boolean(name));

  return (
    <Dropdown.Root open={open} onOpenChange={setOpen}>
      <Dropdown.Trigger className="w-full min-w-[200px] rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-left text-xs text-neutral-600 dark:text-neutral-300">
        {dependencyLabels.length === 0 ? (
          <span className="text-neutral-500 dark:text-neutral-500">
            Set prerequisites
          </span>
        ) : (
          <span className="line-clamp-2">
            {dependencyLabels.join(", ")}
          </span>
        )}
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Positioner side="bottom" align="start" sideOffset={6}>
          <Dropdown.Popup className="min-w-[220px]">
            <Dropdown.Arrow />
            {options.length === 0 ? (
              <div className="px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400">
                No other subtasks yet
              </div>
            ) : (
              options.map((option) => {
                const checked = dependencyIds.includes(option._id);
                return (
                  <Dropdown.CheckboxItem
                    key={option._id}
                    checked={checked}
                    onCheckedChange={(state) =>
                      toggleOption(option._id, state === true)
                    }
                  >
                    <Dropdown.CheckboxItemIndicator>
                      <Check className="h-3 w-3" />
                    </Dropdown.CheckboxItemIndicator>
                    <span className="col-start-2 text-xs text-neutral-700 dark:text-neutral-200">
                      {option.title}
                    </span>
                  </Dropdown.CheckboxItem>
                );
              })
            )}
          </Dropdown.Popup>
        </Dropdown.Positioner>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

type BasicUser = {
  displayName?: string | null;
  primaryEmail?: string | null;
};

function resolveAuthorName(
  message: Doc<"taskBrainstormMessages">,
  user?: BasicUser,
): string {
  if (message.authorType === "user") {
    return user?.displayName || user?.primaryEmail || "You";
  }
  if (message.authorType === "agent") {
    return message.agentName || "Agent";
  }
  return "cmux";
}

function renderAvatarForMessage(message: Doc<"taskBrainstormMessages">) {
  if (message.authorType === "agent") {
    return (
      <div className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-200 flex items-center justify-center text-[11px] font-medium">
        AI
      </div>
    );
  }
  if (message.authorType === "system") {
    return (
      <div className="h-5 w-5 rounded-full bg-neutral-400/30 text-neutral-700 dark:text-neutral-200 flex items-center justify-center text-[11px] font-medium">
        Bot
      </div>
    );
  }
  return undefined;
}
