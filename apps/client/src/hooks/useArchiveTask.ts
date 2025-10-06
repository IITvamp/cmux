import { useRpc } from "@/contexts/socket/use-rpc";
import { api } from "@cmux/convex/api";
import type { Doc } from "@cmux/convex/dataModel";
import { useMutation } from "convex/react";
import { toast } from "sonner";

export function useArchiveTask(teamSlugOrId: string) {
  const { rpcStub } = useRpc();

  type TasksGetArgs = {
    teamSlugOrId: string;
    projectFullName?: string;
    archived?: boolean;
  };

  const archiveMutation = useMutation(api.tasks.archive).withOptimisticUpdate(
    (localStore, args) => {
      const updateLists = (keyArgs: TasksGetArgs) => {
        const active = localStore.getQuery(api.tasks.get, keyArgs);
        if (!active) return;
        const idx = active.findIndex((t) => t._id === args.id);
        if (idx >= 0) {
          const [task] = active.splice(idx, 1);
          // Try to also update the archived list if present in store
          const archivedArgs: TasksGetArgs = { ...keyArgs, archived: true };
          const archived = localStore.getQuery(api.tasks.get, archivedArgs);
          if (archived !== undefined && task) {
            localStore.setQuery(api.tasks.get, archivedArgs, [
              { ...task, isArchived: true },
              ...archived,
            ]);
          }
          localStore.setQuery(api.tasks.get, keyArgs, [...active]);
        }
      };
      // default args variant used across app
      updateLists({ teamSlugOrId });
      updateLists({ teamSlugOrId, archived: false });
    }
  );

  const unarchiveMutation = useMutation(
    api.tasks.unarchive
  ).withOptimisticUpdate((localStore, args) => {
    const updateLists = (keyArgs: TasksGetArgs) => {
      const archivedArgs: TasksGetArgs = { ...keyArgs, archived: true };
      const archived = localStore.getQuery(api.tasks.get, archivedArgs);
      if (!archived) return;
      const idx = archived.findIndex((t) => t._id === args.id);
      if (idx >= 0) {
        const [task] = archived.splice(idx, 1);
        const active = localStore.getQuery(api.tasks.get, keyArgs);
        if (active !== undefined && task) {
          localStore.setQuery(api.tasks.get, keyArgs, [
            { ...task, isArchived: false },
            ...active,
          ]);
        }
        localStore.setQuery(api.tasks.get, archivedArgs, [...archived]);
      }
    };
    updateLists({ teamSlugOrId });
    updateLists({ teamSlugOrId, archived: false });
  });

  const archiveWithUndo = (task: Doc<"tasks">) => {
    archiveMutation({ teamSlugOrId, id: task._id });

    // Call RPC to stop/pause containers
    if (rpcStub) {
      rpcStub
        .archiveTask({ taskId: task._id })
        .then((response) => {
          if (!response.success) {
            console.error("Failed to stop containers:", response.error);
          }
        })
        .catch((error) => {
          console.error("Failed to archive task:", error);
        });
    }

    toast("Task archived", {
      action: {
        label: "Undo",
        onClick: () => unarchiveMutation({ teamSlugOrId, id: task._id }),
      },
    });
  };

  const archive = (id: string) => {
    archiveMutation({
      teamSlugOrId,
      id: id as Doc<"tasks">["_id"],
    });

    // Call RPC to stop/pause containers
    if (rpcStub) {
      rpcStub
        .archiveTask({ taskId: id as Doc<"tasks">["_id"] })
        .then((response) => {
          if (!response.success) {
            console.error("Failed to stop containers:", response.error);
          }
        })
        .catch((error) => {
          console.error("Failed to archive task:", error);
        });
    }
  };

  return {
    archive,
    unarchive: (id: string) =>
      unarchiveMutation({
        teamSlugOrId,
        id: id as Doc<"tasks">["_id"],
      }),
    archiveWithUndo,
  };
}
