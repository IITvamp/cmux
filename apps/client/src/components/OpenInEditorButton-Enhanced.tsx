import { useSocket } from "@/contexts/socket/use-socket";
import { useApplications } from "@/contexts/applications-context";
import { getApplicationIcon } from "@/components/ui/application-icons";
import { ChevronDown, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { toast } from "sonner";
import type { AvailableApplication } from "@cmux/shared";

interface OpenInEditorButtonEnhancedProps {
  workspacePath: string;
}

export function OpenInEditorButtonEnhanced({ workspacePath }: OpenInEditorButtonEnhancedProps) {
  const { socket } = useSocket();
  const { applications } = useApplications();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter available applications and group by type
  const availableApps = useMemo(() => {
    const available = applications.filter(app => app.available);
    return {
      editors: available.filter(app => app.type === "editor"),
      terminals: available.filter(app => app.type === "terminal"),
      ides: available.filter(app => app.type === "ide"),
    };
  }, [applications]);

  const [selectedAppId, setSelectedAppId] = useState<string>(() => {
    const stored = typeof window !== "undefined"
      ? window.localStorage.getItem("cmux:lastOpenWith")
      : null;
    
    // Check if stored app is still available
    if (stored && applications.find(app => app.id === stored && app.available)) {
      return stored;
    }
    
    // Default to first available app
    const firstAvailable = 
      availableApps.editors[0] || 
      availableApps.terminals[0] || 
      availableApps.ides[0];
    
    return firstAvailable?.id || "cursor";
  });

  useEffect(() => {
    window.localStorage.setItem("cmux:lastOpenWith", selectedAppId);
  }, [selectedAppId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleOpenInEditorError = (data: { error: string }) => {
      console.error("Failed to open application:", data.error);
      toast.error(`Failed to open: ${data.error}`);
    };

    socket.on("open-in-editor-error", handleOpenInEditorError);

    return () => {
      socket.off("open-in-editor-error", handleOpenInEditorError);
    };
  }, [socket]);

  const handleOpenWithApp = useCallback((appId: string) => {
    if (workspacePath && socket) {
      const app = applications.find(a => a.id === appId);
      const appName = app?.name || appId;
      
      const loadingToast = toast.loading(`Opening ${appName}...`);
      
      socket.emit(
        "open-in-editor",
        {
          editor: appId,
          path: workspacePath,
        },
        (response) => {
          if (response.success) {
            toast.success(`Opened ${appName}`, { id: loadingToast });
          } else {
            let errorMessage = "Failed to open application";
            if (response.error?.includes("not found") || response.error?.includes("ENOENT")) {
              errorMessage = `${appName} is not installed or not found in PATH`;
            } else if (response.error) {
              errorMessage = response.error;
            }
            toast.error(errorMessage, { id: loadingToast });
          }
        }
      );
    }
  }, [workspacePath, socket, applications]);

  const renderApplicationGroup = (
    title: string,
    apps: AvailableApplication[]
  ) => {
    if (apps.length === 0) return null;

    return (
      <>
        <div className="px-3 py-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400 border-b border-neutral-700">
          {title}
        </div>
        {apps.map((app) => {
          const Icon = getApplicationIcon(app.id);
          return (
            <button
              key={app.id}
              onClick={() => {
                setSelectedAppId(app.id);
                setIsDropdownOpen(false);
                handleOpenWithApp(app.id);
              }}
              className={`w-full px-3 py-2 text-sm text-left hover:bg-neutral-700 transition-colors flex items-center gap-2 ${
                selectedAppId === app.id
                  ? "text-blue-400 bg-neutral-700/50"
                  : "text-neutral-200"
              }`}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {app.name}
            </button>
          );
        })}
      </>
    );
  };

  const selectedApp = applications.find(app => app.id === selectedAppId);
  const SelectedIcon = selectedApp ? getApplicationIcon(selectedApp.id) : ExternalLink;

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center h-8 bg-neutral-800 rounded-md overflow-hidden border border-neutral-700 shadow-sm">
        <button
          onClick={() => handleOpenWithApp(selectedAppId)}
          className="flex items-center gap-2 px-3 py-0 h-full text-sm bg-transparent hover:bg-neutral-700 text-neutral-200 transition-colors flex-1 select-none"
        >
          <SelectedIcon className="w-4 h-4" />
          Open with {selectedApp?.name || "Editor"}
        </button>
        <div className="w-px h-4 bg-neutral-600" />
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center justify-center w-8 h-full bg-transparent hover:bg-neutral-700 text-neutral-200 transition-colors"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      {isDropdownOpen && (
        <div className="absolute right-0 mt-1 w-48 bg-neutral-800 border border-neutral-700 rounded-md shadow-lg z-20 select-none overflow-hidden">
          {renderApplicationGroup("Editors", availableApps.editors)}
          {renderApplicationGroup("Terminals", availableApps.terminals)}
          {renderApplicationGroup("IDEs", availableApps.ides)}
          {availableApps.editors.length === 0 && 
           availableApps.terminals.length === 0 && 
           availableApps.ides.length === 0 && (
            <div className="px-3 py-2 text-sm text-neutral-400">
              No applications detected
            </div>
          )}
        </div>
      )}
    </div>
  );
}