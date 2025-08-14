
import { createContext, useContext } from "react";

interface ExpandTasksContextType {
  expandTaskIds: string[];
  addTaskToExpand: (taskId: string) => void;
  removeTaskFromExpand: (taskId: string) => void;
  setExpandTaskIds: (taskIds: string[]) => void;
}

export const ExpandTasksContext = createContext<ExpandTasksContextType | undefined>(undefined);

export function useExpandTasks() {
  const context = useContext(ExpandTasksContext);
  if (!context) {
    throw new Error("useExpandTasks must be used within an ExpandTasksProvider");
  }
  return context;
}
