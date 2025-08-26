import { useSocket } from "@/contexts/socket/use-socket";
import { useApplications } from "@/contexts/applications-context";
import { getApplicationIcon } from "@/components/ui/application-icons";
import { Menu } from "@base-ui-components/react/menu";
import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MenuArrow } from "./ui/menu";
import type { AvailableApplication } from "@cmux/shared";

interface OpenEditorSplitButtonEnhancedProps {
  worktreePath?: string | null;
  classNameLeft?: string;
  classNameRight?: string;
}

export function OpenEditorSplitButtonEnhanced({
  worktreePath,
  classNameLeft,
  classNameRight,
}: OpenEditorSplitButtonEnhancedProps) {
  const { socket } = useSocket();
  const { applications } = useApplications();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!socket) return;
    const handleOpenInEditorError = (data: { error: string }) => {
      console.error("Failed to open application:", data.error);
    };
    socket.on("open-in-editor-error", handleOpenInEditorError);
    return () => {
      socket.off("open-in-editor-error", handleOpenInEditorError);
    };
  }, [socket]);

  // Filter available applications and group by type
  const availableApps = useMemo(() => {
    const available = applications.filter(app => app.available);
    return {
      editors: available.filter(app => app.type === "editor"),
      terminals: available.filter(app => app.type === "terminal"),
      ides: available.filter(app => app.type === "ide"),
    };
  }, [applications]);

  const [selectedAppId, setSelectedAppId] = useState<string | null>(() => {
    const stored = typeof window !== "undefined"
      ? window.localStorage.getItem("cmux:lastOpenWith")
      : null;
    
    // Check if stored app is still available
    if (stored && applications.find(app => app.id === stored && app.available)) {
      return stored;
    }
    
    // Default to first available editor, terminal, or IDE
    const firstAvailable = 
      availableApps.editors[0] || 
      availableApps.terminals[0] || 
      availableApps.ides[0];
    
    return firstAvailable?.id || null;
  });

  useEffect(() => {
    if (selectedAppId) {
      window.localStorage.setItem("cmux:lastOpenWith", selectedAppId);
    }
  }, [selectedAppId]);

  const handleOpenWithApp = useCallback(
    (appId: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (socket && worktreePath) {
          socket.emit(
            "open-in-editor",
            { editor: appId, path: worktreePath },
            (response: { success: boolean; error?: string }) => {
              if (response.success) resolve();
              else reject(new Error(response.error || "Failed to open application"));
            }
          );
        } else {
          reject(new Error("Unable to open application"));
        }
      });
    },
    [socket, worktreePath]
  );

  const selectedApp = applications.find(app => app.id === selectedAppId);
  const leftDisabled = !selectedApp || !selectedApp.available || !worktreePath;
  const SelectedIcon = selectedApp ? getApplicationIcon(selectedApp.id) : null;

  const openSelected = useCallback(() => {
    if (!selectedApp) return;
    const name = selectedApp.name;
    const loadingToast = toast.loading(`Opening ${name}...`);
    handleOpenWithApp(selectedApp.id)
      .then(() => {
        toast.success(`Opened ${name}`, { id: loadingToast });
      })
      .catch((error: Error) => {
        let errorMessage = "Failed to open application";
        if (
          error.message?.includes("ENOENT") ||
          error.message?.includes("not found") ||
          error.message?.includes("command not found")
        ) {
          errorMessage = `${selectedApp.name} is not installed or not found in PATH`;
        } else if (error.message) {
          errorMessage = error.message;
        }
        toast.error(errorMessage, { id: loadingToast });
      });
  }, [handleOpenWithApp, selectedApp]);

  const renderApplicationGroup = (
    title: string,
    apps: AvailableApplication[]
  ) => {
    if (apps.length === 0) return null;
    
    return (
      <>
        <div className="px-2 py-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {title}
        </div>
        {apps.map((app) => {
          const Icon = getApplicationIcon(app.id);
          return (
            <Menu.RadioItem
              key={app.id}
              value={app.id}
              disabled={!worktreePath}
              className={clsx(
                "grid cursor-default grid-cols-[0.75rem_1rem_1fr] items-center gap-2 py-2 pr-8 pl-2.5 text-sm leading-4 outline-none select-none",
                "data-[highlighted]:relative data-[highlighted]:z-0",
                "data-[highlighted]:text-neutral-50 dark:data-[highlighted]:text-neutral-900",
                "data-[highlighted]:before:absolute data-[highlighted]:before:inset-x-1 data-[highlighted]:before:inset-y-0",
                "data-[highlighted]:before:z-[-1] data-[highlighted]:before:rounded-sm",
                "data-[highlighted]:before:bg-neutral-900 dark:data-[highlighted]:before:bg-neutral-100",
                "data-[disabled]:text-neutral-400 dark:data-[disabled]:text-neutral-600 data-[disabled]:cursor-not-allowed"
              )}
              onClick={() => setMenuOpen(false)}
            >
              <Menu.RadioItemIndicator className="col-start-1">
                <Check className="w-3 h-3" />
              </Menu.RadioItemIndicator>
              {Icon && <Icon className="w-3.5 h-3.5 col-start-2" />}
              <span className="col-start-3">{app.name}</span>
            </Menu.RadioItem>
          );
        })}
      </>
    );
  };

  return (
    <div className="flex items-stretch">
      <button
        onClick={openSelected}
        disabled={leftDisabled}
        className={clsx(
          "flex items-center gap-1.5 px-3 py-1 bg-neutral-800 text-white rounded-l hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs select-none whitespace-nowrap",
          "border border-neutral-700 border-r",
          classNameLeft
        )}
      >
        {SelectedIcon && <SelectedIcon className="w-3.5 h-3.5" />}
        {selectedApp ? selectedApp.name : "Open with"}
      </button>
      <Menu.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <Menu.Trigger
          className={clsx(
            "flex items-center px-2 py-1 bg-neutral-800 text-white rounded-r hover:bg-neutral-700 select-none border border-neutral-700 border-l-0",
            classNameRight
          )}
          title="Choose application"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={5} className="outline-none z-[10001]">
            <Menu.Popup
              className={clsx(
                "origin-[var(--transform-origin)] rounded-md bg-white dark:bg-black py-1",
                "text-neutral-900 dark:text-neutral-100",
                "shadow-lg shadow-neutral-200 dark:shadow-neutral-950",
                "outline outline-neutral-200 dark:outline-neutral-800",
                "transition-[transform,scale,opacity]",
                "data-[ending-style]:scale-90 data-[ending-style]:opacity-0",
                "data-[starting-style]:scale-90 data-[starting-style]:opacity-0",
                "min-w-[200px] max-h-[400px] overflow-y-auto"
              )}
            >
              <MenuArrow />
              <Menu.RadioGroup
                value={selectedAppId || undefined}
                onValueChange={(val) => {
                  setSelectedAppId(val);
                  setMenuOpen(false);
                }}
              >
                {renderApplicationGroup("Editors", availableApps.editors)}
                {renderApplicationGroup("Terminals", availableApps.terminals)}
                {renderApplicationGroup("IDEs", availableApps.ides)}
              </Menu.RadioGroup>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}