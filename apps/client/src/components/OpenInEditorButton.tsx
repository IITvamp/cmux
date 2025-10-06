import { useRpc } from "@/contexts/socket/use-rpc";
import { ChevronDown, ExternalLink } from "lucide-react";
import { useEffect, useRef, useState, useMemo } from "react";

type EditorType =
  | "vscode"
  | "cursor"
  | "windsurf"
  | "finder"
  | "iterm"
  | "terminal"
  | "ghostty"
  | "alacritty"
  | "xcode";

interface OpenInEditorButtonProps {
  workspacePath: string;
}

export function OpenInEditorButton({ workspacePath }: OpenInEditorButtonProps) {
  const [selectedEditor, setSelectedEditor] = useState<EditorType>("cursor");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { rpcStub, availableEditors } = useRpc();

  const editors = useMemo(() => {
    const items: Array<{ id: EditorType; name: string }> = [];
    if (availableEditors?.cursor ?? true)
      items.push({ id: "cursor", name: "Cursor" });
    if (availableEditors?.vscode ?? true)
      items.push({ id: "vscode", name: "VS Code" });
    if (availableEditors?.windsurf ?? true)
      items.push({ id: "windsurf", name: "Windsurf" });
    if (availableEditors?.finder)
      items.push({ id: "finder", name: "Finder" });
    if (availableEditors?.iterm)
      items.push({ id: "iterm", name: "iTerm" });
    if (availableEditors?.terminal)
      items.push({ id: "terminal", name: "Terminal" });
    if (availableEditors?.ghostty)
      items.push({ id: "ghostty", name: "Ghostty" });
    if (availableEditors?.alacritty)
      items.push({ id: "alacritty", name: "Alacritty" });
    if (availableEditors?.xcode)
      items.push({ id: "xcode", name: "Xcode" });
    return items;
  }, [availableEditors]);

  useEffect(() => {
    if (!editors.find((e) => e.id === selectedEditor) && editors[0]) {
      setSelectedEditor(editors[0].id);
    }
  }, [editors, selectedEditor]);

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

  // Socket event listener removed - errors now handled via RPC callback

  const handleOpenInEditor = async () => {
    if (workspacePath && rpcStub) {
      try {
        const response = await rpcStub.openInEditor({
          editor: selectedEditor,
          path: workspacePath,
        });
        if (!response.success) {
          console.error("Failed to open editor:", response.error);
        }
      } catch (error) {
        console.error("Failed to open editor:", error);
      }
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
        <div className="absolute right-0 mt-1 w-40 bg-neutral-800 border border-neutral-700 rounded-md shadow-lg z-[var(--z-popover)] select-none">
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
