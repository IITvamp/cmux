import { api } from "@cmux/convex/api";
import type { Doc } from "@cmux/convex/dataModel";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { useSocket } from "@/contexts/socket/use-socket";

export function useArchiveTask() {
  const { socket } = useSocket();
  
  const archiveMutation = useMutation(api.tasks.archive).withOptimisticUpdate(
    (localStore, args) => {
      const updateLists = (keyArgs: Record<string, any>) => {
        const active = localStore.getQuery(api.tasks.get, keyArgs as any);
        if (!active) return;
        const idx = active.findIndex((t) => t._id === args.id);
        if (idx >= 0) {
          const [task] = active.splice(idx, 1);
          // Try to also update the archived list if present in store
          const archived = localStore.getQuery(api.tasks.get, {
            ...(keyArgs || {}),
            archived: true,
          } as any);
          if (archived !== undefined && task) {
            localStore.setQuery(api.tasks.get, { ...(keyArgs || {}), archived: true } as any, [
              { ...task, isArchived: true },
              ...archived,
            ]);
          }
          localStore.setQuery(api.tasks.get, keyArgs as any, [...active]);
        }
      };
      // default args variant used across app
      updateLists({});
      updateLists({ archived: false });
    }
  );

  const unarchiveMutation = useMutation(api.tasks.unarchive).withOptimisticUpdate(
    (localStore, args) => {
      const updateLists = (keyArgs: Record<string, any>) => {
        const archived = localStore.getQuery(api.tasks.get, {
          ...(keyArgs || {}),
          archived: true,
        } as any);
        if (!archived) return;
        const idx = archived.findIndex((t) => t._id === args.id);
        if (idx >= 0) {
          const [task] = archived.splice(idx, 1);
          const active = localStore.getQuery(api.tasks.get, keyArgs as any);
          if (active !== undefined && task) {
            localStore.setQuery(api.tasks.get, keyArgs as any, [
              { ...task, isArchived: false },
              ...active,
            ]);
          }
          localStore.setQuery(api.tasks.get, { ...(keyArgs || {}), archived: true } as any, [
            ...archived,
          ]);
        }
      };
      updateLists({});
      updateLists({ archived: false });
    }
  );

  const archiveWithUndo = (task: Doc<"tasks">) => {
    archiveMutation({ id: task._id });
    
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
        onClick: () => unarchiveMutation({ id: task._id }),
      },
    });
  };

  const archive = (id: string) => {
    archiveMutation({ id: id as Doc<"tasks">["_id"] });
    
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
    unarchive: (id: string) => unarchiveMutation({ id: id as Doc<"tasks">["_id"] }),
    archiveWithUndo,
  };
}

