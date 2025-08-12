import { DiffEditor } from "@monaco-editor/react";
import { useTheme } from "@/components/theme/use-theme";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, FileText, FilePlus, FileMinus, FileEdit, FileCode } from "lucide-react";
import type { Doc } from "@cmux/convex/dataModel";
import { useState, useEffect, useRef } from "react";

interface GitDiffViewerProps {
  diffs: Doc<"gitDiffs">[];
  isLoading?: boolean;
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

export function GitDiffViewer({ diffs, isLoading }: GitDiffViewerProps) {
  const { theme } = useTheme();
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [editorHeights, setEditorHeights] = useState<Record<string, number>>({});
  const editorRefs = useRef<Record<string, import('monaco-editor').editor.IStandaloneDiffEditor>>({});

  // Group diffs by file
  const fileGroups: FileGroup[] = diffs.map(diff => ({
    filePath: diff.filePath,
    status: diff.status,
    additions: diff.additions,
    deletions: diff.deletions,
    oldContent: diff.oldContent || "",
    newContent: diff.newContent || "",
    patch: diff.patch,
    isBinary: diff.isBinary,
  }));

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
    }
    setExpandedFiles(newExpanded);
  };

  const expandAll = () => {
    setExpandedFiles(new Set(fileGroups.map(f => f.filePath)));
  };

  const collapseAll = () => {
    setExpandedFiles(new Set());
  };

  const getStatusColor = (status: Doc<"gitDiffs">["status"]) => {
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
  };

  const getStatusIcon = (status: Doc<"gitDiffs">["status"]) => {
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
  };

  const calculateEditorHeight = (oldContent: string, newContent: string) => {
    const oldLines = oldContent.split('\n').length;
    const newLines = newContent.split('\n').length;
    const maxLines = Math.max(oldLines, newLines);
    return Math.max(120, maxLines * 20 + 40);
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
    <div className="h-full overflow-y-auto bg-neutral-50 dark:bg-neutral-950">
      {/* Header with summary - GitHub style */}
      <div className="sticky top-0 z-10 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {diffs.length} changed {diffs.length === 1 ? 'file' : 'files'}
            </div>
            <div className="flex items-center gap-2 text-sm">
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
              className="text-xs px-3 py-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium"
            >
              Expand all
            </button>
            <button
              onClick={collapseAll}
              className="text-xs px-3 py-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium"
            >
              Collapse all
            </button>
          </div>
        </div>
      </div>

      {/* Diff sections */}
      <div className="p-4 space-y-4">
        {fileGroups.map((file) => {
          const isExpanded = expandedFiles.has(file.filePath);
          const editorHeight = editorHeights[file.filePath] || calculateEditorHeight(file.oldContent, file.newContent);
          
          return (
            <div 
              key={file.filePath} 
              className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden"
            >
              {/* File header - GitHub style */}
              <button
                onClick={() => toggleFile(file.filePath)}
                className="w-full px-4 py-2 flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors text-left group"
              >
                <div className="text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-400">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
                <div className={cn("flex-shrink-0", getStatusColor(file.status))}>
                  {getStatusIcon(file.status)}
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  <span className="font-mono text-sm text-neutral-700 dark:text-neutral-300 truncate">
                    {file.filePath}
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      +{file.additions}
                    </span>
                    <span className="text-red-600 dark:text-red-400 font-medium">
                      −{file.deletions}
                    </span>
                  </div>
                </div>
              </button>

              {/* Diff content */}
              {isExpanded && (
                <div className="border-t border-neutral-200 dark:border-neutral-800">
                  {file.isBinary ? (
                    <div className="px-4 py-8 text-center text-neutral-500 dark:text-neutral-400 text-sm bg-neutral-50 dark:bg-neutral-900/50">
                      Binary file not shown
                    </div>
                  ) : file.status === "deleted" ? (
                    <div className="px-4 py-8 text-center text-neutral-500 dark:text-neutral-400 text-sm bg-neutral-50 dark:bg-neutral-900/50">
                      File was deleted
                    </div>
                  ) : (
                    <div style={{ height: `${editorHeight}px` }}>
                      <DiffEditor
                        original={file.oldContent}
                        modified={file.newContent}
                        language={getLanguageFromPath(file.filePath)}
                        theme={theme === "dark" ? "vs-dark" : "vs"}
                        onMount={(editor) => {
                          editorRefs.current[file.filePath] = editor;
                          const updateHeight = () => {
                            const modifiedEditor = editor.getModifiedEditor();
                            const originalEditor = editor.getOriginalEditor();
                            const modifiedContentHeight = modifiedEditor.getContentHeight();
                            const originalContentHeight = originalEditor.getContentHeight();
                            const newHeight = Math.max(120, Math.max(modifiedContentHeight, originalContentHeight) + 20);
                            if (newHeight !== editorHeights[file.filePath]) {
                              setEditorHeights(prev => ({
                                ...prev,
                                [file.filePath]: newHeight
                              }));
                            }
                          };
                          const mod = editor.getModifiedEditor();
                          const orig = editor.getOriginalEditor();
                          const disposables = [
                            mod.onDidContentSizeChange(updateHeight),
                            orig.onDidContentSizeChange(updateHeight),
                            mod.onDidChangeHiddenAreas(updateHeight),
                            orig.onDidChangeHiddenAreas(updateHeight),
                          ];
                          setTimeout(updateHeight, 50);
                          return () => {
                            disposables.forEach(d => d.dispose());
                          };
                        }}
                        options={{
                          readOnly: true,
                          renderSideBySide: true,
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          fontSize: 13,
                          fontFamily: "'SF Mono', Monaco, 'Courier New', monospace",
                          wordWrap: "off",
                          automaticLayout: true,
                          scrollbar: {
                            vertical: 'hidden',
                            horizontal: 'auto',
                            verticalScrollbarSize: 10,
                            horizontalScrollbarSize: 10,
                            alwaysConsumeMouseWheel: false,
                          },
                          lineNumbers: "on",
                          renderLineHighlight: "none",
                          hideCursorInOverviewRuler: true,
                          overviewRulerBorder: false,
                          renderValidationDecorations: "off",
                          diffWordWrap: "off",
                          renderIndicators: true,
                          renderMarginRevertIcon: false,
                          lineDecorationsWidth: 3,
                          lineNumbersMinChars: 4,
                          glyphMargin: false,
                          folding: false,
                          contextmenu: false,
                          renderWhitespace: "selection",
                          guides: {
                            indentation: false,
                          },
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
        })}
      </div>
    </div>
  );
}

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
