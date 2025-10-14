import { api } from "@cmux/convex/api";
import type { Doc } from "@cmux/convex/dataModel";
import { useQuery } from "convex/react";
import { memo, useMemo, useState } from "react";
import { TaskItem } from "./TaskItem";

export const TaskList = memo(function TaskList({
  teamSlugOrId,
}: {
  teamSlugOrId: string;
}) {
  const allTasks = useQuery(api.tasks.get, { teamSlugOrId });
  const archivedTasks = useQuery(api.tasks.get, {
    teamSlugOrId,
    archived: true,
  });
  const brainstormSummaries = useQuery(api.taskBrainstorms.listSummaries, {
    teamSlugOrId,
  });
  const [tab, setTab] = useState<"all" | "archived">("all");
  const tasks = tab === "archived" ? archivedTasks : allTasks;

  const brainstormByTaskId = useMemo(() => {
    if (!brainstormSummaries) {
      return new Map<string, Doc<"taskBrainstorms">["status"]>();
    }
    return brainstormSummaries.reduce((map, summary) => {
      map.set(summary.taskId, summary.status);
      return map;
    }, new Map<string, Doc<"taskBrainstorms">["status"]>());
  }, [brainstormSummaries]);

  return (
    <div className="mt-6">
      <div className="mb-3">
        <div className="flex items-end gap-2.5 select-none">
          <button
            className={
              "text-sm font-medium transition-colors " +
              (tab === "all"
                ? "text-neutral-900 dark:text-neutral-100"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200")
            }
            onMouseDown={() => setTab("all")}
            onClick={() => setTab("all")}
          >
            Tasks
          </button>
          <button
            className={
              "text-sm font-medium transition-colors " +
              (tab === "archived"
                ? "text-neutral-900 dark:text-neutral-100"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200")
            }
            onMouseDown={() => setTab("archived")}
            onClick={() => setTab("archived")}
          >
            Archived
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {tasks === undefined ? (
          <div className="text-sm text-neutral-500 dark:text-neutral-400 py-2 select-none">
            Loading...
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-sm text-neutral-500 dark:text-neutral-400 py-2 select-none">
            {tab === "all" ? "No active tasks" : "No archived tasks"}
          </div>
        ) : (
          tasks.map((task) => (
            <TaskItem
              key={task._id}
              task={task}
              teamSlugOrId={teamSlugOrId}
              brainstormStatus={brainstormByTaskId.get(task._id) ?? null}
            />
          ))
        )}
      </div>
    </div>
  );
});
