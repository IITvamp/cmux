import { DiffEditor } from "@monaco-editor/react";
import { useTheme } from "@/components/theme/use-theme";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, FileText, FilePlus, FileMinus, FileEdit, FileCode } from "lucide-react";
import type { Doc } from "@cmux/convex/dataModel";
import { useState, useEffect, useRef, memo, useMemo } from "react";
import { useSocket } from "@/contexts/socket/use-socket";

interface GitDiffViewerProps {
  diffs: Doc<"gitDiffs">[];
  isLoading?: boolean;
  taskRunId?: string;
}

interface FileGroup {
  filePath: string;
  status: Doc<"gitDiffs">["status"];
  additions: number;
  deletions: number;
  oldContent: string;
  newContent: string;
  patch?: string;
  isBinary: boolean;
}

function getStatusColor(status: Doc<"gitDiffs">["status"]) {
  switch (status) {
    case "added":
      return "text-green-600 dark:text-green-400";
    case "deleted":
      return "text-red-600 dark:text-red-400";
    case "modified":
      return "text-yellow-600 dark:text-yellow-400";
    case "renamed":
      return "text-blue-600 dark:text-blue-400";
    default:
      return "text-neutral-500";
  }
}

function getStatusIcon(status: Doc<"gitDiffs">["status"]) {
  const iconClass = "w-4 h-4 flex-shrink-0";
  switch (status) {
    case "added":
      return <FilePlus className={iconClass} />;
    case "deleted":
      return <FileMinus className={iconClass} />;
    case "modified":
      return <FileEdit className={iconClass} />;
    case "renamed":
      return <FileCode className={iconClass} />;
    default:
      return <FileText className={iconClass} />;
  }
}

export function GitDiffViewer({ diffs, isLoading, taskRunId }: GitDiffViewerProps) {
  const { theme } = useTheme();
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const editorRefs = useRef<Record<string, import('monaco-editor').editor.IStandaloneDiffEditor>>({});
  const [lazyContents, setLazyContents] = useState<Record<string, { oldContent: string; newContent: string }>>({});
  const { socket } = useSocket();

  // Group diffs by file
  const fileGroups: FileGroup[] = useMemo(() => diffs.map(diff => ({
    filePath: diff.filePath,
    status: diff.status,
    additions: diff.additions,
    deletions: diff.deletions,
    oldContent: (lazyContents[diff.filePath]?.oldContent ?? diff.oldContent) || "",
    newContent: (lazyContents[diff.filePath]?.newContent ?? diff.newContent) || "",
    patch: diff.patch,
    isBinary: diff.isBinary,
  })), [diffs, lazyContents]);

  // Auto-expand files on initial load or when diffs change
  useEffect(() => {
    // Expand all files by default (like GitHub)
    setExpandedFiles(new Set(fileGroups.map(f => f.filePath)));
  }, [diffs]);

  const toggleFile = (filePath: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(filePath)) {
      newExpanded.delete(filePath);
    } else {
      newExpanded.add(filePath);
      // If content was omitted due to size, fetch on demand
      const diff = diffs.find(d => d.filePath === filePath);
      if (diff && diff.contentOmitted && taskRunId && socket) {
        socket.emit("git-diff-file-contents", { taskRunId, filePath }, (res) => {
          if (res.ok) {
            setLazyContents(prev => ({
              ...prev,
              [filePath]: { oldContent: res.oldContent || "", newContent: res.newContent || "" },
            }));
          }
        });
      }
    }
    setExpandedFiles(newExpanded);
  };

  const expandAll = () => {
    setExpandedFiles(new Set(fileGroups.map(f => f.filePath)));
  };

  const collapseAll = () => {
    setExpandedFiles(new Set());
  };

  

  const calculateEditorHeight = (oldContent: string, newContent: string) => {
    const oldLines = oldContent.split('\n').length;
    const newLines = newContent.split('\n').length;
    const maxLines = Math.max(oldLines, newLines);
    // approximate using compact line height of 18px + small padding
    return Math.max(100, maxLines * 18 + 24);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-neutral-500 dark:text-neutral-400">
          Loading diffs...
        </div>
      </div>
    );
  }

  if (diffs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-neutral-500 dark:text-neutral-400">
          No changes to display
        </div>
      </div>
    );
  }

  const totalAdditions = diffs.reduce((sum, d) => sum + d.additions, 0);
  const totalDeletions = diffs.reduce((sum, d) => sum + d.deletions, 0);

  return (
    <div className="h-full overflow-y-auto hide-scrollbar bg-neutral-50 dark:bg-neutral-950">
      {/* Header with summary - GitHub style */}
      <div className="sticky top-0 z-10 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <div className="px-3 py-1 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
              {diffs.length} changed {diffs.length === 1 ? 'file' : 'files'}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-green-600 dark:text-green-400 font-medium">
                +{totalAdditions}
              </span>
              <span className="text-red-600 dark:text-red-400 font-medium">
                −{totalDeletions}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={expandAll}
              className="text-[11px] px-2 py-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium"
            >
              Expand all
            </button>
            <button
              onClick={collapseAll}
              className="text-[11px] px-2 py-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium"
            >
              Collapse all
            </button>
          </div>
        </div>
      </div>

      {/* Diff sections */}
      <div className="p-2 space-y-2">
        {fileGroups.map((file) => (
          <MemoFileDiffRow
            key={file.filePath}
            file={file}
            isExpanded={expandedFiles.has(file.filePath)}
            onToggle={() => toggleFile(file.filePath)}
            theme={theme}
            calculateEditorHeight={calculateEditorHeight}
            setEditorRef={(ed) => { if (ed) editorRefs.current[file.filePath] = ed; }}
          />
        ))}
      </div>
    </div>
  );
}

interface FileDiffRowProps {
  file: FileGroup;
  isExpanded: boolean;
  onToggle: () => void;
  theme: string | undefined;
  calculateEditorHeight: (oldContent: string, newContent: string) => number;
  setEditorRef: (ed: import('monaco-editor').editor.IStandaloneDiffEditor | null) => void;
}

function FileDiffRow({ file, isExpanded, onToggle, theme, calculateEditorHeight, setEditorRef }: FileDiffRowProps) {
  const [height, setHeight] = useState<number>(() => calculateEditorHeight(file.oldContent, file.newContent));

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors text-left group"
      >
        <div className="text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-400">
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </div>
        <div className={cn("flex-shrink-0", getStatusColor(file.status))}>
          {getStatusIcon(file.status)}
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <span className="font-mono text-xs text-neutral-700 dark:text-neutral-300 truncate">
            {file.filePath}
          </span>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-green-600 dark:text-green-400 font-medium">+{file.additions}</span>
            <span className="text-red-600 dark:text-red-400 font-medium">−{file.deletions}</span>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-neutral-200 dark:border-neutral-800">
          {file.isBinary ? (
            <div className="px-3 py-6 text-center text-neutral-500 dark:text-neutral-400 text-xs bg-neutral-50 dark:bg-neutral-900/50">
              Binary file not shown
            </div>
          ) : file.status === "deleted" ? (
            <div className="px-3 py-6 text-center text-neutral-500 dark:text-neutral-400 text-xs bg-neutral-50 dark:bg-neutral-900/50">
              File was deleted
            </div>
          ) : (
            <div style={{ height: `${height}px` }}>
              <DiffEditor
                key={file.filePath}
                original={file.oldContent}
                modified={file.newContent}
                language={getLanguageFromPath(file.filePath)}
                theme={theme === "dark" ? "vs-dark" : "vs"}
                onMount={(editor) => {
                  setEditorRef(editor);
                  const updateHeight = () => {
                    const modifiedEditor = editor.getModifiedEditor();
                    const originalEditor = editor.getOriginalEditor();
                    const modifiedContentHeight = modifiedEditor.getContentHeight();
                    const originalContentHeight = originalEditor.getContentHeight();
                    const newHeight = Math.max(120, Math.max(modifiedContentHeight, originalContentHeight) + 20);
                    setHeight((prev) => (prev !== newHeight ? newHeight : prev));
                  };
                  const mod = editor.getModifiedEditor();
                  const orig = editor.getOriginalEditor();
                  const d1 = mod.onDidContentSizeChange(updateHeight);
                  const d2 = orig.onDidContentSizeChange(updateHeight);
                  const d3 = mod.onDidChangeHiddenAreas(updateHeight);
                  const d4 = orig.onDidChangeHiddenAreas(updateHeight);
                  setTimeout(updateHeight, 50);
                  return () => {
                    d1.dispose();
                    d2.dispose();
                    d3.dispose();
                    d4.dispose();
                  };
                }}
                options={{
                  readOnly: true,
                  renderSideBySide: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 12,
                  lineHeight: 18,
                  fontFamily: "'SF Mono', Monaco, 'Courier New', monospace",
                  wordWrap: "on",
                  automaticLayout: true,
                  renderOverviewRuler: false,
                  scrollbar: {
                    vertical: 'hidden',
                    horizontal: 'hidden',
                    verticalScrollbarSize: 8,
                    horizontalScrollbarSize: 8,
                    handleMouseWheel: false,
                    alwaysConsumeMouseWheel: false,
                  },
                  lineNumbers: "on",
                  renderLineHighlight: "none",
                  hideCursorInOverviewRuler: true,
                  overviewRulerBorder: false,
                  overviewRulerLanes: 0,
                  renderValidationDecorations: "off",
                  diffWordWrap: "on",
                  renderIndicators: true,
                  renderMarginRevertIcon: false,
                  lineDecorationsWidth: 2,
                  lineNumbersMinChars: 3,
                  glyphMargin: false,
                  folding: false,
                  contextmenu: false,
                  renderWhitespace: "selection",
                  guides: {
                    indentation: false,
                  },
                  padding: { top: 2, bottom: 2 },
                  hideUnchangedRegions: {
                    enabled: true,
                    revealLineCount: 3,
                    minimumLineCount: 50,
                    contextLineCount: 3,
                  },
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const MemoFileDiffRow = memo(
  FileDiffRow,
  (prev, next) => {
    const a = prev.file;
    const b = next.file;
    return (
      prev.isExpanded === next.isExpanded &&
      prev.theme === next.theme &&
      a.filePath === b.filePath &&
      a.status === b.status &&
      a.additions === b.additions &&
      a.deletions === b.deletions &&
      a.isBinary === b.isBinary &&
      (a.patch || "") === (b.patch || "") &&
      a.oldContent === b.oldContent &&
      a.newContent === b.newContent
    );
  }
);

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    md: "markdown",
    css: "css",
    scss: "scss",
    html: "html",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    py: "python",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    cpp: "cpp",
    cs: "csharp",
    php: "php",
    rb: "ruby",
    swift: "swift",
    kt: "kotlin",
    scala: "scala",
    sh: "shell",
    bash: "shell",
    sql: "sql",
    dockerfile: "dockerfile",
  };
  
  return languageMap[ext || ""] || "plaintext";
}
