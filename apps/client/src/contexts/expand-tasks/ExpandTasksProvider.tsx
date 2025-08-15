
import { useSessionStorage } from "@mantine/hooks";
import { useCallback } from "react";
import { ExpandTasksContext } from "./ExpandTasksContext";

export function ExpandTasksProvider({ children }: { children: React.ReactNode }) {
  const [expandTaskIds, setExpandTaskIds] = useSessionStorage<string[]>({
    key: "expandTaskIds",
    defaultValue: [],
    getInitialValueInEffect: true,
  });

  const addTaskToExpand = useCallback(
    (taskId: string) => {
      setExpandTaskIds((prev) => {
        if (prev.includes(taskId)) {
          return prev;
        }
        return [...prev, taskId];
      });
    },
    [setExpandTaskIds]
  );

  const removeTaskFromExpand = useCallback(
    (taskId: string) => {
      setExpandTaskIds((prev) => prev.filter((id) => id !== taskId));
    },
    [setExpandTaskIds]
  );

  return (
    <ExpandTasksContext.Provider
      value={{ expandTaskIds, addTaskToExpand, removeTaskFromExpand, setExpandTaskIds }}
    >
      {children}
    </ExpandTasksContext.Provider>
  );
}
