import { useSocket } from "@/contexts/socket/use-socket";
import { ChevronDown, ExternalLink } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type EditorType = "vscode" | "cursor" | "windsurf";

interface OpenInEditorButtonProps {
  workspacePath: string;
}

export function OpenInEditorButton({ workspacePath }: OpenInEditorButtonProps) {
  const [selectedEditor, setSelectedEditor] = useState<EditorType>("cursor");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { socket } = useSocket();

  const editors: Array<{ id: EditorType; name: string }> = [
    { id: "cursor", name: "Cursor" },
    { id: "vscode", name: "VS Code" },
    { id: "windsurf", name: "Windsurf" },
  ];

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
      console.error("Failed to open editor:", data.error);
      // You could add a toast notification here if you have a notification system
    };

    socket.on("open-in-editor-error", handleOpenInEditorError);

    return () => {
      socket.off("open-in-editor-error", handleOpenInEditorError);
    };
  }, [socket]);

  const handleOpenInEditor = () => {
    if (workspacePath && socket) {
      socket.emit(
        "open-in-editor",
        {
          editor: selectedEditor,
          path: workspacePath,
        },
        (response) => {
          if (!response.success) {
            console.error("Failed to open editor:", response.error);
          }
        }
      );
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center h-8 bg-neutral-800 rounded-md overflow-hidden border border-neutral-700 shadow-sm">
        <button
          onClick={handleOpenInEditor}
          className="flex items-center gap-2 px-3 py-0 h-full text-sm bg-transparent hover:bg-neutral-700 text-neutral-200 transition-colors flex-1 select-none"
        >
          <ExternalLink className="w-4 h-4" />
          Open in {editors.find((e) => e.id === selectedEditor)?.name}
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
        <div className="absolute right-0 mt-1 w-40 bg-neutral-800 border border-neutral-700 rounded-md shadow-lg z-20 select-none">
          {editors.map((editor) => (
            <button
              key={editor.id}
              onClick={() => {
                setSelectedEditor(editor.id);
                setIsDropdownOpen(false);
              }}
              className={`w-full px-3 py-2 text-sm text-left hover:bg-neutral-700 transition-colors first:rounded-t-md last:rounded-b-md ${
                selectedEditor === editor.id
                  ? "text-blue-400 bg-neutral-700/50"
                  : "text-neutral-200"
              }`}
            >
              {editor.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
