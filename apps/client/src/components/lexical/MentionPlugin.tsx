import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  TextNode,
} from "lexical";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FileInfo } from "@coderouter/shared";
import { useSocket } from "../../contexts/socket/use-socket";
import { getIconForFile } from "vscode-icons-js";

const MENTION_TRIGGER = "@";

interface MentionMenuProps {
  files: FileInfo[];
  selectedIndex: number;
  onSelect: (file: FileInfo) => void;
  position: { top: number; left: number } | null;
  hasRepository: boolean;
  isLoading: boolean;
}

function MentionMenu({ files, selectedIndex, onSelect, position, hasRepository, isLoading }: MentionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (menuRef.current && selectedIndex >= 0) {
      const selectedElement = menuRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);


  if (!position) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="absolute z-50 w-80 max-h-60 overflow-y-auto bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {isLoading ? (
        <div className="px-3 py-4 text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading files...
        </div>
      ) : files.length === 0 ? (
        <div className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">
          {hasRepository ? "No files found" : "Please select a project to see files"}
        </div>
      ) : (
        files.map((file, index) => (
          <button
            key={file.relativePath}
            onClick={() => onSelect(file)}
            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
              index === selectedIndex 
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100" 
                : "hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
            }`}
            type="button"
          >
            <img 
              src={`https://cdn.jsdelivr.net/gh/vscode-icons/vscode-icons/icons/${getIconForFile(file.name)}`}
              alt=""
              className="w-4 h-4 flex-shrink-0"
            />
            <span className="truncate">{file.relativePath}</span>
          </button>
        ))
      )}
    </div>,
    document.body
  );
}

interface MentionPluginProps {
  repoUrl?: string;
  branch?: string;
}

export function MentionPlugin({ repoUrl, branch }: MentionPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [isShowingMenu, setIsShowingMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [searchText, setSearchText] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<FileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const triggerNodeRef = useRef<TextNode | null>(null);
  const { socket } = useSocket();

  // Fetch files when repository URL is available
  useEffect(() => {
    if (repoUrl && socket) {
      setIsLoading(true);
      socket.emit("list-files", { repoUrl, branch: branch || "main" });
      
      // Set a timeout to stop loading after 30 seconds
      const timeoutId = setTimeout(() => {
        setIsLoading(false);
      }, 30000);
      
      const handleFilesResponse = (data: { files: FileInfo[]; error?: string }) => {
        clearTimeout(timeoutId);
        setIsLoading(false);
        if (!data.error) {
          // Filter to only show actual files, not directories
          const fileList = data.files.filter(f => !f.isDirectory);
          setFiles(fileList);
        } else {
          setFiles([]);
        }
      };
      
      socket.on("list-files-response", handleFilesResponse);
      
      return () => {
        clearTimeout(timeoutId);
        socket.off("list-files-response", handleFilesResponse);
      };
    } else {
      // If no repository URL, set empty files list
      setFiles([]);
      setIsLoading(false);
    }
  }, [repoUrl, branch, socket]);

  // Filter files based on search text
  useEffect(() => {
    if (searchText) {
      const filtered = files.filter(file =>
        file.relativePath.toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredFiles(filtered);
      setSelectedIndex(0);
    } else {
      setFilteredFiles(files);
      setSelectedIndex(0);
    }
  }, [searchText, files]);

  const hideMenu = useCallback(() => {
    setIsShowingMenu(false);
    setMenuPosition(null);
    setSearchText("");
    setSelectedIndex(0);
    triggerNodeRef.current = null;
  }, []);

  const selectFile = useCallback(
    (file: FileInfo) => {
      // Store the trigger node before it gets cleared
      const currentTriggerNode = triggerNodeRef.current;
      
      editor.update(() => {
        const selection = $getSelection();
        
        if ($isRangeSelection(selection) && currentTriggerNode) {
          const triggerText = currentTriggerNode.getTextContent();
          const mentionStartIndex = triggerText.lastIndexOf(MENTION_TRIGGER);
          
          if (mentionStartIndex !== -1) {
            // Replace @ and search text with @filename and a space
            currentTriggerNode.spliceText(
              mentionStartIndex,
              triggerText.length - mentionStartIndex,
              `@${file.relativePath} `,
              true
            );
          }
        }
      });
      hideMenu();
    },
    [editor, hideMenu]
  );

  useEffect(() => {
    const checkForMentionTrigger = () => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
        hideMenu();
        return;
      }

      const node = selection.anchor.getNode();
      if (!$isTextNode(node)) {
        hideMenu();
        return;
      }

      const text = node.getTextContent();
      const offset = selection.anchor.offset;
      
      // Find the last @ before the cursor
      let mentionStartIndex = -1;
      for (let i = offset - 1; i >= 0; i--) {
        if (text[i] === MENTION_TRIGGER) {
          mentionStartIndex = i;
          break;
        }
        // Stop if we hit whitespace
        if (/\s/.test(text[i])) {
          break;
        }
      }

      if (mentionStartIndex !== -1) {
        const searchQuery = text.slice(mentionStartIndex + 1, offset);
        setSearchText(searchQuery);
        triggerNodeRef.current = node;

        // Calculate menu position
        const domSelection = window.getSelection();
        if (domSelection && domSelection.rangeCount > 0) {
          const range = domSelection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setMenuPosition({
            top: rect.bottom + window.scrollY + 4,
            left: rect.left + window.scrollX,
          });
          setIsShowingMenu(true);
        }
      } else {
        hideMenu();
      }
    };

    return editor.registerUpdateListener(() => {
      editor.getEditorState().read(() => {
        checkForMentionTrigger();
      });
    });
  }, [editor, hideMenu]);

  // Store current state in refs to avoid stale closures
  const isShowingMenuRef = useRef(isShowingMenu);
  const filteredFilesRef = useRef(filteredFiles);
  const selectedIndexRef = useRef(selectedIndex);

  useEffect(() => {
    isShowingMenuRef.current = isShowingMenu;
  }, [isShowingMenu]);

  useEffect(() => {
    filteredFilesRef.current = filteredFiles;
  }, [filteredFiles]);

  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleArrowDown = () => {
      if (!isShowingMenuRef.current) return false;
      setSelectedIndex((prev) => {
        const maxIndex = filteredFilesRef.current.length - 1;
        return prev < maxIndex ? prev + 1 : 0;
      });
      return true;
    };

    const handleArrowUp = () => {
      if (!isShowingMenuRef.current) return false;
      setSelectedIndex((prev) => {
        const maxIndex = filteredFilesRef.current.length - 1;
        return prev > 0 ? prev - 1 : maxIndex;
      });
      return true;
    };

    const handleEnter = (event?: KeyboardEvent) => {
      if (!isShowingMenuRef.current) return false;
      
      const files = filteredFilesRef.current;
      const index = selectedIndexRef.current;
      
      if (files.length > 0 && files[index]) {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        selectFile(files[index]);
        return true;
      }
      return false;
    };

    const handleEscape = () => {
      if (!isShowingMenuRef.current) return false;
      hideMenu();
      return true;
    };

    // Handle Ctrl+N/P and Ctrl+J/K
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isShowingMenuRef.current) return;

      if (event.ctrlKey) {
        switch (event.key) {
          case "n":
          case "j":
            event.preventDefault();
            handleArrowDown();
            break;
          case "p":
          case "k":
            event.preventDefault();
            handleArrowUp();
            break;
        }
      }
    };

    const removeArrowDown = editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      handleArrowDown,
      COMMAND_PRIORITY_HIGH
    );

    const removeArrowUp = editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      handleArrowUp,
      COMMAND_PRIORITY_HIGH
    );

    const removeEnter = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => handleEnter(event || undefined),
      COMMAND_PRIORITY_HIGH
    );

    const removeEscape = editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      handleEscape,
      COMMAND_PRIORITY_HIGH
    );

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      removeArrowDown();
      removeArrowUp();
      removeEnter();
      removeEscape();
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [editor, selectFile, hideMenu]);

  return (
    <MentionMenu
      files={filteredFiles}
      selectedIndex={selectedIndex}
      onSelect={selectFile}
      position={menuPosition}
      hasRepository={!!repoUrl}
      isLoading={isLoading}
    />
  );
}