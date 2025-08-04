import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useSocket } from "@/contexts/socket/use-socket";
import { Code2, ChevronDown } from "lucide-react";
import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";

type EditorType = "vscode-remote" | "cursor" | "vscode" | "windsurf";

interface OpenWithDropdownProps {
  vscodeUrl?: string | null;
  worktreePath?: string | null;
  className?: string;
  iconClassName?: string;
}

export function OpenWithDropdown({ 
  vscodeUrl,
  worktreePath,
  className,
  iconClassName = "w-3.5 h-3.5"
}: OpenWithDropdownProps) {
  const { socket } = useSocket();
  const [isOpen, setIsOpen] = useState(false);

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

  const handleOpenInEditor = useCallback((editor: EditorType) => {
    if (editor === "vscode-remote" && vscodeUrl) {
      window.open(vscodeUrl, "_blank", "noopener,noreferrer");
    } else if (socket && ["cursor", "vscode", "windsurf"].includes(editor) && worktreePath) {
      socket.emit("open-in-editor", {
        editor: editor as "cursor" | "vscode" | "windsurf",
        path: worktreePath,
      });
    }
  }, [socket, worktreePath, vscodeUrl]);

  const menuItems = [
    { id: "vscode-remote" as EditorType, name: "VS Code (remote)", enabled: !!vscodeUrl },
    { id: "cursor" as EditorType, name: "Cursor", enabled: !!worktreePath },
    { id: "vscode" as EditorType, name: "VS Code (local)", enabled: !!worktreePath },
    { id: "windsurf" as EditorType, name: "Windsurf", enabled: !!worktreePath },
  ];

  return (
    <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className={clsx(
            "p-1 rounded flex items-center gap-1",
            "bg-neutral-100 dark:bg-neutral-700",
            "text-neutral-600 dark:text-neutral-400",
            "hover:bg-neutral-200 dark:hover:bg-neutral-600",
            className
          )}
          title="Open with"
        >
          <Code2 className={iconClassName} />
          <ChevronDown className="w-2.5 h-2.5" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[160px] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg p-1 z-50"
          sideOffset={5}
          onClick={(e) => e.stopPropagation()}
        >
          {menuItems.map((item) => (
            <DropdownMenu.Item
              key={item.id}
              disabled={!item.enabled}
              onSelect={() => handleOpenInEditor(item.id)}
              className={clsx(
                "flex items-center px-2 py-1.5 text-sm rounded cursor-default outline-none",
                item.enabled
                  ? "text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                  : "text-neutral-400 dark:text-neutral-500 cursor-not-allowed"
              )}
            >
              {item.name}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}