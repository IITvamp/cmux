import type { AvailableApplication, DetectApplicationsResponse } from "@cmux/shared";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useSocket } from "./socket/use-socket";

interface ApplicationsContextType {
  applications: AvailableApplication[];
  isLoading: boolean;
  refreshApplications: () => void;
}

const ApplicationsContext = createContext<ApplicationsContextType | undefined>(undefined);

export function ApplicationsProvider({ children }: { children: ReactNode }) {
  const { socket } = useSocket();
  const [applications, setApplications] = useState<AvailableApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshApplications = () => {
    if (!socket) return;
    
    setIsLoading(true);
    socket.emit("detect-applications", (response: DetectApplicationsResponse) => {
      setApplications(response.applications);
      setIsLoading(false);
    });
  };

  useEffect(() => {
    if (!socket) return;

    const handleDetectedApplications = (data: DetectApplicationsResponse) => {
      setApplications(data.applications);
      setIsLoading(false);
    };

    socket.on("detected-applications", handleDetectedApplications);

    return () => {
      socket.off("detected-applications", handleDetectedApplications);
    };
  }, [socket]);

  return (
    <ApplicationsContext.Provider value={{ applications, isLoading, refreshApplications }}>
      {children}
    </ApplicationsContext.Provider>
  );
}

export function useApplications() {
  const context = useContext(ApplicationsContext);
  if (!context) {
    throw new Error("useApplications must be used within ApplicationsProvider");
  }
  return context;
}