import { useSocket } from "@/contexts/socket/use-socket";
import { Menu } from "@base-ui-components/react/menu";
import clsx from "clsx";
import { ChevronDown, Code2 } from "lucide-react";
import * as React from "react";
import { useCallback, useEffect } from "react";

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
    (editor: EditorType) => {
      console.log("open in editor", editor, vscodeUrl, worktreePath);
      if (editor === "vscode-remote" && vscodeUrl) {
        window.open(vscodeUrl, "_blank", "noopener,noreferrer");
      } else if (
        socket &&
        ["cursor", "vscode", "windsurf"].includes(editor) &&
        worktreePath
      ) {
        socket.emit("open-in-editor", {
          editor: editor as "cursor" | "vscode" | "windsurf",
          path: worktreePath,
        });
      }
    },
    [socket, worktreePath, vscodeUrl]
  );

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
  ];

  return (
    <Menu.Root>
      <Menu.Trigger
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
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="outline-none z-[9999]" sideOffset={8}>
          <Menu.Popup
            onClick={(e) => e.stopPropagation()}
            className="origin-[var(--transform-origin)] rounded-md bg-white dark:bg-black py-1 text-neutral-900 dark:text-neutral-100 shadow-lg shadow-neutral-200 dark:shadow-neutral-950 outline outline-neutral-200 dark:outline-neutral-800 transition-[transform,scale,opacity] data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0"
          >
            <Menu.Arrow className="data-[side=bottom]:top-[-8px] data-[side=left]:right-[-13px] data-[side=left]:rotate-90 data-[side=right]:left-[-13px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-8px] data-[side=top]:rotate-180">
              <ArrowSvg />
            </Menu.Arrow>
            {menuItems.map((item) => (
              <Menu.Item
                key={item.id}
                disabled={!item.enabled}
                onClick={() => {
                  handleOpenInEditor(item.id);
                }}
                className="flex cursor-default py-2 pr-8 pl-4 text-sm leading-4 outline-none select-none data-[highlighted]:relative data-[highlighted]:z-0 data-[highlighted]:text-neutral-50 dark:data-[highlighted]:text-neutral-900 data-[highlighted]:before:absolute data-[highlighted]:before:inset-x-1 data-[highlighted]:before:inset-y-0 data-[highlighted]:before:z-[-1] data-[highlighted]:before:rounded-sm data-[highlighted]:before:bg-neutral-900 dark:data-[highlighted]:before:bg-neutral-100 data-[disabled]:text-neutral-400 dark:data-[disabled]:text-neutral-600 data-[disabled]:cursor-not-allowed"
              >
                {item.name}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function ArrowSvg(props: React.ComponentProps<"svg">) {
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" {...props}>
      <path
        d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
        className="fill-white dark:fill-black"
      />
      <path
        d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
        className="fill-neutral-200 dark:fill-neutral-800"
      />
      <path
        d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
        className="stroke-neutral-200 dark:stroke-neutral-800 fill-none"
      />
    </svg>
  );
}
