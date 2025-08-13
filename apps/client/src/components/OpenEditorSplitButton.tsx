import { Dropdown } from "@/components/ui/dropdown";
import { useSocket } from "@/contexts/socket/use-socket";
import clsx from "clsx";
import { ChevronDown, Package } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type EditorType = "cursor" | "vscode" | "windsurf" | "finder";

interface OpenEditorSplitButtonProps {
  worktreePath?: string | null;
  classNameLeft?: string;
  classNameRight?: string;
}

export function OpenEditorSplitButton({
  worktreePath,
  classNameLeft,
  classNameRight,
}: OpenEditorSplitButtonProps) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;
    const handleOpenInEditorError = (data: { error: string }) => {
      console.error("Failed to open editor:", data.error);
    };
    socket.on("open-in-editor-error", handleOpenInEditorError);
    return () => {
      socket.off("open-in-editor-error", handleOpenInEditorError);
    };
  }, [socket]);

  const menuItems = useMemo(
    () => [
      { id: "vscode" as const, name: "VS Code", enabled: !!worktreePath },
      { id: "cursor" as const, name: "Cursor", enabled: !!worktreePath },
      { id: "windsurf" as const, name: "Windsurf", enabled: !!worktreePath },
      { id: "finder" as const, name: "Finder", enabled: !!worktreePath },
    ],
    [worktreePath]
  );

  const [selectedEditor, setSelectedEditor] = useState<EditorType | null>(
    () => {
      const raw =
        typeof window !== "undefined"
          ? window.localStorage.getItem("cmux:lastEditor")
          : null;
      const stored =
        raw === "vscode-remote"
          ? worktreePath
            ? "vscode"
            : null
          : (raw as EditorType | null);
      if (stored) return stored;
      if (worktreePath) return "vscode";
      return null;
    }
  );

  useEffect(() => {
    if (selectedEditor) {
      window.localStorage.setItem("cmux:lastEditor", selectedEditor);
    }
  }, [selectedEditor]);

  const handleOpenInEditor = useCallback(
    (editor: EditorType): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (
          socket &&
          ["cursor", "vscode", "windsurf", "finder"].includes(editor) &&
          worktreePath
        ) {
          socket.emit(
            "open-in-editor",
            { editor, path: worktreePath },
            (response: { success: boolean; error?: string }) => {
              if (response.success) resolve();
              else reject(new Error(response.error || "Failed to open editor"));
            }
          );
        } else {
          reject(new Error("Unable to open editor"));
        }
      });
    },
    [socket, worktreePath]
  );

  const selected = menuItems.find((m) => m.id === selectedEditor) || null;
  const leftDisabled = !selected || !selected.enabled;

  const openSelected = useCallback(() => {
    if (!selected) return;
    const name = selected.name;
    const loadingToast = toast.loading(`Opening ${name}...`);
    handleOpenInEditor(selected.id)
      .then(() => {
        toast.success(`Opened ${name}`, { id: loadingToast });
      })
      .catch((error: Error) => {
        let errorMessage = "Failed to open editor";
        if (
          error.message?.includes("ENOENT") ||
          error.message?.includes("not found") ||
          error.message?.includes("command not found")
        ) {
          if (selected.id === "vscode")
            errorMessage = "VS Code is not installed or not found in PATH";
          else if (selected.id === "cursor")
            errorMessage = "Cursor is not installed or not found in PATH";
          else if (selected.id === "windsurf")
            errorMessage = "Windsurf is not installed or not found in PATH";
          else if (selected.id === "finder")
            errorMessage = "Finder is not available or not found";
        } else if (error.message) {
          errorMessage = error.message;
        }
        toast.error(errorMessage, { id: loadingToast });
      });
  }, [handleOpenInEditor, selected]);

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
        <Package className="w-3.5 h-3.5" />
        {selected ? selected.name : "Open in editor"}
      </button>
      <Dropdown.Root>
        <Dropdown.Trigger
          className={clsx(
            "flex items-center px-2 py-1 bg-neutral-800 text-white rounded-r hover:bg-neutral-700 select-none border border-neutral-700 border-l-0",
            classNameRight
          )}
          title="Choose editor"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </Dropdown.Trigger>
        <Dropdown.Portal>
          <Dropdown.Positioner sideOffset={5}>
            <Dropdown.Popup>
              <Dropdown.Arrow />
              {menuItems.map((item) => (
                <Dropdown.Item
                  key={item.id}
                  disabled={!item.enabled}
                  onClick={() => setSelectedEditor(item.id)}
                >
                  {item.name}
                </Dropdown.Item>
              ))}
            </Dropdown.Popup>
          </Dropdown.Positioner>
        </Dropdown.Portal>
      </Dropdown.Root>
    </div>
  );
}
