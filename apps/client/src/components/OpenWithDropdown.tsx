import { Dropdown } from "@/components/ui/dropdown";
import { useSocket } from "@/contexts/socket/use-socket";
import clsx from "clsx";
import { ChevronDown, Code2 } from "lucide-react";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";

type EditorType = "vscode-remote" | "cursor" | "vscode" | "windsurf" | "finder";

interface OpenWithDropdownProps {
  vscodeUrl?: string | null;
  worktreePath?: string | null;
  branch?: string | null;
  className?: string;
  iconClassName?: string;
}

export function OpenWithDropdown({
  vscodeUrl,
  worktreePath,
  branch,
  className,
  iconClassName = "w-3.5 h-3.5",
}: OpenWithDropdownProps) {
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

  const handleOpenInEditor = useCallback(
    (editor: EditorType): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (editor === "vscode-remote" && vscodeUrl) {
          window.open(vscodeUrl, "_blank", "noopener,noreferrer");
          resolve();
        } else if (
          socket &&
          ["cursor", "vscode", "windsurf", "finder"].includes(editor) &&
          worktreePath
        ) {
          socket.emit(
            "open-in-editor",
            {
              editor: editor as "cursor" | "vscode" | "windsurf" | "finder",
              path: worktreePath,
            },
            (response) => {
              if (response.success) {
                resolve();
              } else {
                reject(new Error(response.error || "Failed to open editor"));
              }
            }
          );
        } else {
          reject(new Error("Unable to open editor"));
        }
      });
    },
    [socket, worktreePath, vscodeUrl]
  );

  const handleCopyBranch = useCallback(() => {
    if (branch) {
      navigator.clipboard
        .writeText(branch)
        .then(() => {
          toast.success(`Copied branch: ${branch}`);
        })
        .catch(() => {
          toast.error("Failed to copy branch");
        });
    }
  }, [branch]);

  const menuItems = [
    {
      id: "vscode-remote" as EditorType,
      name: "VS Code (remote)",
      enabled: !!vscodeUrl,
    },
    { id: "cursor" as EditorType, name: "Cursor", enabled: !!worktreePath },
    {
      id: "vscode" as EditorType,
      name: "VS Code (local)",
      enabled: !!worktreePath,
    },
    { id: "windsurf" as EditorType, name: "Windsurf", enabled: !!worktreePath },
    { id: "finder" as EditorType, name: "Finder", enabled: !!worktreePath },
  ];

  return (
    <Dropdown.Root>
      <Dropdown.Trigger
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
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Positioner sideOffset={8}>
          <Dropdown.Popup>
            <Dropdown.Arrow />
            {menuItems.map((item) => (
              <Dropdown.Item
                key={item.id}
                disabled={!item.enabled}
                onClick={() => {
                  const loadingToast = toast.loading(`Opening ${item.name}...`);

                  handleOpenInEditor(item.id)
                    .then(() => {
                      toast.success(`Opened ${item.name}`, {
                        id: loadingToast,
                      });
                    })
                    .catch((error) => {
                      let errorMessage = "Failed to open editor";

                      // Handle specific error cases
                      if (
                        error.message?.includes("ENOENT") ||
                        error.message?.includes("not found") ||
                        error.message?.includes("command not found")
                      ) {
                        errorMessage = `${item.name} is not installed or not found in PATH`;
                      } else if (error.message) {
                        errorMessage = error.message;
                      }

                      toast.error(errorMessage, {
                        id: loadingToast,
                      });
                    });
                }}
              >
                {item.name}
              </Dropdown.Item>
            ))}
            {branch && (
              <>
                <Dropdown.Item onClick={handleCopyBranch}>
                  Copy branch
                </Dropdown.Item>
              </>
            )}
          </Dropdown.Popup>
        </Dropdown.Positioner>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
