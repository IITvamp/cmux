import { api } from "@cmux/convex/api";
import type { Doc } from "@cmux/convex/dataModel";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { useSocket } from "@/contexts/socket/use-socket";

export function useArchiveTask(teamSlugOrId: string) {
  const { socket } = useSocket();
  
  type TasksGetArgs = {
    teamIdOrSlug: string;
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
      updateLists({ teamIdOrSlug: teamSlugOrId });
      updateLists({ teamIdOrSlug: teamSlugOrId, archived: false });
    }
  );

  const unarchiveMutation = useMutation(api.tasks.unarchive).withOptimisticUpdate(
    (localStore, args) => {
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
      updateLists({ teamIdOrSlug: teamSlugOrId });
      updateLists({ teamIdOrSlug: teamSlugOrId, archived: false });
    }
  );

  const archiveWithUndo = (task: Doc<"tasks">) => {
    archiveMutation({ teamIdOrSlug: teamSlugOrId, id: task._id });
    
    // Emit socket event to stop/pause containers
    if (socket) {
      socket.emit("archive-task", { taskId: task._id }, (response: { success: boolean; error?: string }) => {
        if (!response.success) {
          console.error("Failed to stop containers:", response.error);
        }
      });
    }
    
    toast("Task archived", {
      action: {
        label: "Undo",
        onClick: () => unarchiveMutation({ teamIdOrSlug: teamSlugOrId, id: task._id }),
      },
    });
  };

  const archive = (id: string) => {
    archiveMutation({ teamIdOrSlug: teamSlugOrId, id: id as Doc<"tasks">["_id"] });
    
    // Emit socket event to stop/pause containers
    if (socket) {
      socket.emit("archive-task", { taskId: id as Doc<"tasks">["_id"] }, (response: { success: boolean; error?: string }) => {
        if (!response.success) {
          console.error("Failed to stop containers:", response.error);
        }
      });
    }
  };

  return {
    archive,
    unarchive: (id: string) => unarchiveMutation({ teamIdOrSlug: teamSlugOrId, id: id as Doc<"tasks">["_id"] }),
    archiveWithUndo,
  };
}
