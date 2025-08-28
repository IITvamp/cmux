import { useTheme } from "@/components/theme/use-theme";
import { cn } from "@/lib/utils";
import type { ReplaceDiffEntry } from "@cmux/shared/diff-types";
import { DiffEditor } from "@monaco-editor/react";
import {
  ChevronDown,
  ChevronRight,
  FileCode,
  FileEdit,
  FileMinus,
  FilePlus,
  FileText,
  MessageSquare,
  Plus,
  X,
} from "lucide-react";
import { type editor } from "monaco-editor";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface CodeReviewViewerProps {
  diffs: ReplaceDiffEntry[];
  isLoading?: boolean;
  onControlsChange?: (controls: {
    expandAll: () => void;
    collapseAll: () => void;
    totalAdditions: number;
    totalDeletions: number;
  }) => void;
}

type FileGroup = {
  filePath: string;
  status: ReplaceDiffEntry["status"];
  additions: number;
  deletions: number;
  oldContent: string;
  newContent: string;
  patch?: string;
  isBinary: boolean;
};

interface LineComment {
  id: string;
  filePath: string;
  lineNumber: number;
  side: "original" | "modified";
  text: string;
  createdAt: Date;
  author?: string;
  resolved?: boolean;
}

interface LineSelection {
  filePath: string;
  startLine: number;
  endLine: number;
  side: "original" | "modified";
}

function getStatusColor(status: ReplaceDiffEntry["status"]) {
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

function getStatusIcon(status: ReplaceDiffEntry["status"]) {
  const iconClass = "w-3.5 h-3.5 flex-shrink-0";
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

export function CodeReviewViewer({
  diffs,
  isLoading,
  onControlsChange,
}: CodeReviewViewerProps) {
  const { theme } = useTheme();
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">(() => {
    if (theme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return theme as "dark" | "light";
  });

  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<LineComment[]>([]);
  const [activeCommentBox, setActiveCommentBox] = useState<LineSelection | null>(null);
  const [highlightedLines, setHighlightedLines] = useState<LineSelection[]>([]);
  const editorRefs = useRef<Record<string, editor.IStandaloneDiffEditor>>({});

  useEffect(() => {
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => {
        setResolvedTheme(mediaQuery.matches ? "dark" : "light");
      };
      setResolvedTheme(mediaQuery.matches ? "dark" : "light");
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else {
      setResolvedTheme(theme as "dark" | "light");
    }
  }, [theme]);

  const fileGroups: FileGroup[] = useMemo(
    () =>
      (diffs || []).map((diff) => ({
        filePath: diff.filePath,
        status: diff.status,
        additions: diff.additions,
        deletions: diff.deletions,
        oldContent: diff.oldContent || "",
        newContent: diff.newContent || "",
        patch: diff.patch,
        isBinary: diff.isBinary,
      })),
    [diffs]
  );

  useEffect(() => {
    const nextPaths = new Set(diffs.map((d) => d.filePath));
    setExpandedFiles(nextPaths);
  }, [diffs]);

  const toggleFile = (filePath: string) => {
    setExpandedFiles((prev) => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(filePath)) {
        newExpanded.delete(filePath);
      } else {
        newExpanded.add(filePath);
      }
      return newExpanded;
    });
  };

  const expandAll = () => {
    setExpandedFiles(new Set(fileGroups.map((f) => f.filePath)));
  };

  const collapseAll = () => {
    setExpandedFiles(new Set());
  };

  const totalAdditions = diffs.reduce((sum, d) => sum + d.additions, 0);
  const totalDeletions = diffs.reduce((sum, d) => sum + d.deletions, 0);

  useEffect(() => {
    onControlsChange?.({
      expandAll,
      collapseAll,
      totalAdditions,
      totalDeletions,
    });
  }, [totalAdditions, totalDeletions, diffs.length]);

  const handleLineClick = useCallback((
    filePath: string,
    lineNumber: number,
    side: "original" | "modified",
    event: React.MouseEvent
  ) => {
    if (event.shiftKey && highlightedLines.length > 0) {
      const lastSelection = highlightedLines[highlightedLines.length - 1];
      if (lastSelection.filePath === filePath && lastSelection.side === side) {
        const newSelection: LineSelection = {
          filePath,
          startLine: Math.min(lastSelection.startLine, lineNumber),
          endLine: Math.max(lastSelection.endLine, lineNumber),
          side,
        };
        setHighlightedLines([...highlightedLines.slice(0, -1), newSelection]);
      }
    } else {
      const newSelection: LineSelection = {
        filePath,
        startLine: lineNumber,
        endLine: lineNumber,
        side,
      };
      setHighlightedLines([newSelection]);
    }
  }, [highlightedLines]);

  const handleAddComment = useCallback((selection: LineSelection) => {
    setActiveCommentBox(selection);
  }, []);

  const handleSubmitComment = useCallback((text: string) => {
    if (activeCommentBox && text.trim()) {
      const newComment: LineComment = {
        id: `comment-${Date.now()}`,
        filePath: activeCommentBox.filePath,
        lineNumber: activeCommentBox.startLine,
        side: activeCommentBox.side,
        text: text.trim(),
        createdAt: new Date(),
        author: "You",
        resolved: false,
      };
      setComments([...comments, newComment]);
      setActiveCommentBox(null);
      setHighlightedLines([]);
    }
  }, [activeCommentBox, comments]);

  const handleCancelComment = useCallback(() => {
    setActiveCommentBox(null);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-neutral-500 dark:text-neutral-400 text-sm select-none">
          Loading diffs...
        </div>
      </div>
    );
  }

  if (diffs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-neutral-500 dark:text-neutral-400 text-sm select-none">
          No changes to display
        </div>
      </div>
    );
  }

  return (
    <div className="grow bg-white dark:bg-neutral-900">
      <div className="">
        {fileGroups.map((file) => (
          <ReviewFileDiffRow
            key={file.filePath}
            file={file}
            isExpanded={expandedFiles.has(file.filePath)}
            onToggle={() => toggleFile(file.filePath)}
            theme={resolvedTheme}
            onLineClick={handleLineClick}
            highlightedLines={highlightedLines.filter(l => l.filePath === file.filePath)}
            comments={comments.filter(c => c.filePath === file.filePath)}
            activeCommentBox={activeCommentBox?.filePath === file.filePath ? activeCommentBox : null}
            onAddComment={handleAddComment}
            onSubmitComment={handleSubmitComment}
            onCancelComment={handleCancelComment}
            setEditorRef={(ed) => {
              if (ed) editorRefs.current[file.filePath] = ed;
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface ReviewFileDiffRowProps {
  file: FileGroup;
  isExpanded: boolean;
  onToggle: () => void;
  theme: string;
  onLineClick: (filePath: string, lineNumber: number, side: "original" | "modified", event: React.MouseEvent) => void;
  highlightedLines: LineSelection[];
  comments: LineComment[];
  activeCommentBox: LineSelection | null;
  onAddComment: (selection: LineSelection) => void;
  onSubmitComment: (text: string) => void;
  onCancelComment: () => void;
  setEditorRef: (ed: editor.IStandaloneDiffEditor) => void;
}

function ReviewFileDiffRow({
  file,
  isExpanded,
  onToggle,
  theme,
  onLineClick,
  highlightedLines,
  comments,
  activeCommentBox,
  onAddComment,
  onSubmitComment,
  onCancelComment,
  setEditorRef,
}: ReviewFileDiffRowProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [commentText, setCommentText] = useState("");

  const calculateEditorHeight = (oldContent: string, newContent: string) => {
    const oldLines = oldContent.split("\n").length;
    const newLines = newContent.split("\n").length;
    const maxLines = Math.max(oldLines, newLines);
    return Math.max(100, maxLines * 20 + 40);
  };

  useLayoutEffect(() => {
    const initial = calculateEditorHeight(file.oldContent, file.newContent);
    if (containerRef.current) {
      containerRef.current.style.height = `${Math.max(120, initial)}px`;
    }
  }, [file.oldContent, file.newContent]);

  const handleCommentSubmit = () => {
    onSubmitComment(commentText);
    setCommentText("");
  };

  const isLineHighlighted = (lineNumber: number, side: "original" | "modified") => {
    return highlightedLines.some(
      hl => hl.side === side && 
      lineNumber >= hl.startLine && 
      lineNumber <= hl.endLine
    );
  };

  const getCommentsForLine = (lineNumber: number, side: "original" | "modified") => {
    return comments.filter(c => c.lineNumber === lineNumber && c.side === side);
  };

  return (
    <div className="bg-white dark:bg-neutral-900">
      <button
        onClick={onToggle}
        className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors text-left group pt-1 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 sticky top-[96px] md:top-[56px] z-40"
      >
        <div className="text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-400">
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </div>
        <div className={cn("flex-shrink-0", getStatusColor(file.status))}>
          {getStatusIcon(file.status)}
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <span className="font-mono text-xs text-neutral-700 dark:text-neutral-300 truncate select-none">
            {file.filePath}
          </span>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-green-600 dark:text-green-400 font-medium select-none">
              +{file.additions}
            </span>
            <span className="text-red-600 dark:text-red-400 font-medium select-none">
              −{file.deletions}
            </span>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-neutral-200 dark:border-neutral-800 overflow-hidden relative">
          {file.isBinary ? (
            <div className="px-3 py-6 text-center text-neutral-500 dark:text-neutral-400 text-xs bg-neutral-50 dark:bg-neutral-900/50">
              Binary file not shown
            </div>
          ) : file.status === "deleted" ? (
            <div className="px-3 py-6 text-center text-neutral-500 dark:text-neutral-400 text-xs bg-neutral-50 dark:bg-neutral-900/50">
              File was deleted
            </div>
          ) : (
            <>
              <div ref={containerRef} className="relative">
                <DiffEditor
                  original={file.oldContent}
                  modified={file.newContent}
                  language={getLanguageFromPath(file.filePath)}
                  theme={theme === "dark" ? "vs-dark" : "vs"}
                  onMount={(editor) => {
                    setEditorRef(editor);
                    
                    // Add line decorations for highlighting
                    const updateDecorations = () => {
                      const originalEditor = editor.getOriginalEditor();
                      const modifiedEditor = editor.getModifiedEditor();
                      
                      const originalDecorations: editor.IModelDeltaDecoration[] = [];
                      const modifiedDecorations: editor.IModelDeltaDecoration[] = [];
                      
                      highlightedLines.forEach(hl => {
                        const decoration: editor.IModelDeltaDecoration = {
                          range: {
                            startLineNumber: hl.startLine,
                            startColumn: 1,
                            endLineNumber: hl.endLine,
                            endColumn: 1000,
                          },
                          options: {
                            isWholeLine: true,
                            className: 'bg-blue-100 dark:bg-blue-900/30',
                            glyphMarginClassName: 'bg-blue-500',
                          }
                        };
                        
                        if (hl.side === "original") {
                          originalDecorations.push(decoration);
                        } else {
                          modifiedDecorations.push(decoration);
                        }
                      });
                      
                      originalEditor.deltaDecorations([], originalDecorations);
                      modifiedEditor.deltaDecorations([], modifiedDecorations);
                    };
                    
                    updateDecorations();
                    
                    // Add click handlers for line selection
                    const handleEditorClick = (e: editor.IEditorMouseEvent, side: "original" | "modified") => {
                      const target = e.target;
                      if (target.type === 2 || target.type === 3) { // Line number or glyph margin
                        const lineNumber = target.position?.lineNumber;
                        if (lineNumber) {
                          onLineClick(file.filePath, lineNumber, side, e.event.browserEvent);
                          updateDecorations();
                        }
                      }
                    };
                    
                    originalEditor.onMouseDown((e) => handleEditorClick(e, "original"));
                    modifiedEditor.onMouseDown((e) => handleEditorClick(e, "modified"));
                  }}
                  options={{
                    readOnly: true,
                    renderSideBySide: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 12,
                    lineHeight: 20,
                    fontFamily:
                      "'JetBrains Mono', 'SF Mono', Monaco, 'Courier New', monospace",
                    wordWrap: "on",
                    automaticLayout: true,
                    renderOverviewRuler: false,
                    scrollbar: {
                      vertical: "auto",
                      horizontal: "auto",
                      verticalScrollbarSize: 8,
                      horizontalScrollbarSize: 8,
                    },
                    lineNumbers: "on",
                    renderLineHighlight: "gutter",
                    glyphMargin: true,
                    folding: false,
                    contextmenu: false,
                    renderWhitespace: "selection",
                  }}
                />
                
                {/* Floating comment button */}
                {highlightedLines.length > 0 && !activeCommentBox && (
                  <div className="absolute top-2 right-2 z-50">
                    <button
                      onClick={() => onAddComment(highlightedLines[0])}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-medium shadow-lg transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Add comment
                    </button>
                  </div>
                )}
              </div>

              {/* Comment box */}
              {activeCommentBox && (
                <div className="border-t border-neutral-200 dark:border-neutral-800 p-4 bg-neutral-50 dark:bg-neutral-900/50">
                  <div className="max-w-2xl mx-auto">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 text-neutral-500 mt-1" />
                      <div className="flex-1">
                        <textarea
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Write a comment..."
                          className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          rows={3}
                          autoFocus
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={handleCommentSubmit}
                            disabled={!commentText.trim()}
                            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-medium transition-colors"
                          >
                            Comment
                          </button>
                          <button
                            onClick={() => {
                              onCancelComment();
                              setCommentText("");
                            }}
                            className="px-3 py-1 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200 rounded text-xs font-medium transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Display comments */}
              {comments.length > 0 && (
                <div className="border-t border-neutral-200 dark:border-neutral-800 p-4 bg-neutral-50 dark:bg-neutral-900/50">
                  <div className="space-y-3">
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                          {comment.author?.[0] || "?"}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                              {comment.author}
                            </span>
                            <span className="text-xs text-neutral-500">
                              Line {comment.lineNumber} ({comment.side})
                            </span>
                          </div>
                          <div className="text-sm text-neutral-700 dark:text-neutral-300">
                            {comment.text}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
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