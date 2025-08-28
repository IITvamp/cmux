import { useTheme } from "@/components/theme/use-theme";
import { useSocket } from "@/contexts/socket/use-socket";
import { cn } from "@/lib/utils";
import type { Id } from "@cmux/convex/dataModel";
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
} from "lucide-react";
import { type editor } from "monaco-editor";
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface GitDiffViewerProps {
  diffs: ReplaceDiffEntry[];
  isLoading?: boolean;
  taskRunId?: Id<"taskRuns">;
  onControlsChange?: (controls: {
    expandAll: () => void;
    collapseAll: () => void;
    totalAdditions: number;
    totalDeletions: number;
  }) => void;
  reviewMode?: boolean;
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

const kitties = [
  // kitty1
  `\
   /\\_/\\     
  ( =.= )    💤
   (> <)>☕   
_____|_____
|  LAPTOP   |
|  ======== |
| if(tired) |
| sleep();  |
|___________|
 ||    ||`,
  // kitty2
  `\
/\\_/\\
(='.'=)
(")_(")`,
  // bunny
  `\
(\\  /)
( ^.^ )
c(")(")`,
];

export function GitDiffViewer({
  diffs,
  isLoading,
  taskRunId,
  onControlsChange,
  reviewMode,
}: GitDiffViewerProps) {
  const { theme } = useTheme();
  // Resolve the actual theme (handle "system" theme)
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">(() => {
    if (theme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return theme as "dark" | "light";
  });

  const kitty = useMemo(() => {
    return kitties[Math.floor(Math.random() * kitties.length)];
    // return kitties[2];
  }, []);

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

  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const editorRefs = useRef<Record<string, editor.IStandaloneDiffEditor>>({});
  // Cache fetched contents per run+file to avoid cross-run flashes
  const [lazyContents, setLazyContents] = useState<
    Record<string, { oldContent: string; newContent: string }>
  >({});
  const { socket } = useSocket();

  // Group diffs by file
  const fileGroups: FileGroup[] = useMemo(
    () =>
      (diffs || []).map((diff) => ({
        filePath: diff.filePath,
        status: diff.status,
        additions: diff.additions,
        deletions: diff.deletions,
        oldContent:
          (lazyContents[`${taskRunId ?? "_"}:${diff.filePath}`]?.oldContent ??
            diff.oldContent) ||
          "",
        newContent:
          (lazyContents[`${taskRunId ?? "_"}:${diff.filePath}`]?.newContent ??
            diff.newContent) ||
          "",
        patch: diff.patch,
        isBinary: diff.isBinary,
      })),
    [diffs, lazyContents, taskRunId]
  );

  // Maintain minimal reactivity; no debug logging in production
  useEffect(() => {
    // No-op effect to keep hook ordering consistent if needed later
  }, [diffs]);

  // Maintain expansion state across refreshes:
  // - On first load: expand all
  // - On subsequent diffs changes: preserve existing expansions, expand only truly new files
  //   (detected via previous file list, not by expansion set)
  const prevFilesRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const nextPathsArr = diffs.map((d) => d.filePath);
    const nextPaths = new Set(nextPathsArr);
    setExpandedFiles((prev) => {
      // First load: expand everything
      if (prevFilesRef.current == null) {
        return new Set(nextPaths);
      }
      const next = new Set<string>();
      // Keep expansions that still exist
      for (const p of prev) {
        if (nextPaths.has(p)) next.add(p);
      }
      // Expand only files not seen before (true additions)
      for (const p of nextPaths) {
        if (!prevFilesRef.current.has(p)) next.add(p);
      }
      return next;
    });
    // Update the seen file set after computing the next expansion state
    prevFilesRef.current = nextPaths;
  }, [diffs]);

  const toggleFile = (filePath: string) => {
    setExpandedFiles((prev) => {
      const newExpanded = new Set(prev);
      const wasExpanded = newExpanded.has(filePath);
      if (wasExpanded) newExpanded.delete(filePath);
      else newExpanded.add(filePath);
      // If content was omitted due to size, fetch on demand
      if (!wasExpanded) {
        const diff = diffs.find((d) => d.filePath === filePath);
        if (diff && diff.contentOmitted && taskRunId && socket) {
          socket.emit(
            "git-diff-file-contents",
            { taskRunId, filePath },
            (res) => {
              if (res.ok) {
                setLazyContents((prev) => ({
                  ...prev,
                  [`${taskRunId}:${filePath}`]: {
                    oldContent: res.oldContent || "",
                    newContent: res.newContent || "",
                  },
                }));
              }
            }
          );
        }
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

  // Clear per-run caches on run switch to prevent flashing old content
  useEffect(() => {
    // Reset lazy contents for new run
    setLazyContents({});
  }, [taskRunId]);

  const calculateEditorHeight = (oldContent: string, newContent: string) => {
    const oldLines = oldContent.split("\n").length;
    const newLines = newContent.split("\n").length;
    const maxLines = Math.max(oldLines, newLines);
    // approximate using compact line height of 18px + small padding
    return Math.max(100, maxLines * 18 + 24);
  };

  // Compute totals consistently before any conditional early-returns
  const totalAdditions = diffs.reduce((sum, d) => sum + d.additions, 0);
  const totalDeletions = diffs.reduce((sum, d) => sum + d.deletions, 0);

  // Keep a stable ref to the controls handler to avoid effect loops
  const controlsHandlerRef = useRef<
    | ((args: {
        expandAll: () => void;
        collapseAll: () => void;
        totalAdditions: number;
        totalDeletions: number;
      }) => void)
    | null
  >(null);
  useEffect(() => {
    controlsHandlerRef.current = onControlsChange ?? null;
  }, [onControlsChange]);
  useEffect(() => {
    controlsHandlerRef.current?.({
      expandAll,
      collapseAll,
      totalAdditions,
      totalDeletions,
    });
    // Totals update when diffs change; avoid including function identities
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalAdditions, totalDeletions, diffs.length]);

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
    <div key={taskRunId ?? "_"} className="grow bg-white dark:bg-neutral-900">
      {/* Lightweight styles for inline review decorations */}
      <style>
        {`
        .monaco-editor .cmux-comment-line { 
          background-color: rgba(30, 144, 255, 0.14);
        }
        .monaco-editor.vs-dark .cmux-comment-line,
        .vs-dark .monaco-editor .cmux-comment-line { 
          background-color: rgba(59, 130, 246, 0.22);
        }
        .monaco-editor .cmux-comment-glyph { 
          width: 4px !important;
          background-color: #1f883d;
          border-radius: 2px;
          margin-left: 2px;
        }
        `}
      </style>
      {/* Diff sections */}
      <div className="">
        {fileGroups.map((file) => (
          <MemoFileDiffRow
            key={`${taskRunId ?? "_"}:${file.filePath}`}
            file={file}
            isExpanded={expandedFiles.has(file.filePath)}
            onToggle={() => toggleFile(file.filePath)}
            theme={resolvedTheme}
            calculateEditorHeight={calculateEditorHeight}
            setEditorRef={(ed) => {
              if (ed)
                editorRefs.current[`${taskRunId ?? "_"}:${file.filePath}`] = ed;
            }}
            runId={taskRunId}
            reviewMode={!!reviewMode}
          />
        ))}
        {/* End-of-diff message */}
        <div className="px-3 py-6 text-center">
          <span className="text-xs text-neutral-500 dark:text-neutral-400 select-none">
            You’ve reached the end of the diff!
          </span>
          <div className="grid place-content-center">
            <pre className="text-[8px] text-left text-neutral-500 dark:text-neutral-400 select-none mt-2 pb-20 font-mono">
              {kitty}
            </pre>
          </div>
        </div>
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
  setEditorRef: (ed: editor.IStandaloneDiffEditor) => void;
  runId?: string;
  reviewMode: boolean;
}

function FileDiffRow({
  file,
  isExpanded,
  onToggle,
  theme,
  calculateEditorHeight,
  setEditorRef,
  runId,
  reviewMode,
}: FileDiffRowProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const revealedRef = useRef<boolean>(false);
  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  const [pendingComment, setPendingComment] = useState<
    | {
        startLine: number;
        endLine: number;
        topPx: number;
      }
    | null
  >(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [comments, setComments] = useState<
    { id: string; startLine: number; endLine: number; text: string }[]
  >([]);
  const decorationsRef = useRef<string[]>([]);

  // Set an initial height before paint to reduce flicker
  useLayoutEffect(() => {
    const initial = calculateEditorHeight(file.oldContent, file.newContent);
    if (containerRef.current) {
      containerRef.current.style.height = `${Math.max(120, initial)}px`;
    }
    // Only depend on file contents used for initial sizing
  }, [file.oldContent, file.newContent, calculateEditorHeight]);

  // No debug logs in production
  useEffect(() => {
    // noop
  }, [isExpanded, file.filePath]);

  // Review mode: watch selection and scrolling to position pending comment UI
  useEffect(() => {
    const diff = diffEditorRef.current;
    if (!diff || !reviewMode) {
      setPendingComment(null);
      return;
    }
    const mod = diff.getModifiedEditor();
    const disposables: { dispose: () => void }[] = [];

    const updateFromSelection = () => {
      const sel = mod.getSelection();
      if (!sel) return;
      const start = Math.min(sel.startLineNumber, sel.endLineNumber);
      const end = Math.max(sel.startLineNumber, sel.endLineNumber);
      const top = mod.getTopForLineNumber(start) - mod.getScrollTop();
      setPendingComment({ startLine: start, endLine: end, topPx: Math.max(0, top) });
    };

    disposables.push(mod.onDidChangeCursorSelection(updateFromSelection));
    disposables.push(
      mod.onDidScrollChange(() => {
        setPendingComment((cur) => {
          if (!cur) return null;
          const top = mod.getTopForLineNumber(cur.startLine) - mod.getScrollTop();
          return { ...cur, topPx: Math.max(0, top) };
        });
      })
    );

    // Initialize position if there's an existing selection
    updateFromSelection();
    return () => {
      disposables.forEach((d) => d.dispose());
    };
  }, [reviewMode]);

  // Keep line decorations in sync with current comments
  useEffect(() => {
    const diff = diffEditorRef.current;
    const ed = diff?.getModifiedEditor();
    const model = ed?.getModel();
    if (!diff || !ed || !model) return;
    try {
      const ranges = comments.map((x) => ({
        range: {
          startLineNumber: x.startLine,
          startColumn: 1,
          endLineNumber: x.endLine,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: "cmux-comment-line",
          linesDecorationsClassName: "cmux-comment-glyph",
        },
      }));
      const ids = ed.deltaDecorations(decorationsRef.current, ranges);
      decorationsRef.current = ids;
    } catch {
      // ignore
    }
  }, [comments, theme]);

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
        <div className="border-t border-neutral-200 dark:border-neutral-800 overflow-hidden">
          {file.isBinary ? (
            <div className="px-3 py-6 text-center text-neutral-500 dark:text-neutral-400 text-xs bg-neutral-50 dark:bg-neutral-900/50">
              Binary file not shown
            </div>
          ) : file.status === "deleted" ? (
            <div className="px-3 py-6 text-center text-neutral-500 dark:text-neutral-400 text-xs bg-neutral-50 dark:bg-neutral-900/50">
              File was deleted
            </div>
          ) : (
            <div ref={containerRef} className="relative">
              <DiffEditor
                key={`${runId ?? "_"}:${theme ?? "_"}:${file.filePath}`}
                original={file.oldContent}
                modified={file.newContent}
                language={getLanguageFromPath(file.filePath)}
                theme={theme === "dark" ? "vs-dark" : "vs"}
                onMount={(editor, monaco) => {
                  setEditorRef(editor);
                  diffEditorRef.current = editor;
                  // Start hidden to avoid intermediate flashes
                  if (containerRef.current) {
                    containerRef.current.style.visibility = "hidden";
                  }

                  // Create fresh models per run+file to avoid reuse across runs
                  try {
                    const language = getLanguageFromPath(file.filePath);
                    const originalUri = monaco.Uri.parse(
                      `inmemory://diff/${runId ?? "_"}/${encodeURIComponent(
                        file.filePath
                      )}?side=original`
                    );
                    const modifiedUri = monaco.Uri.parse(
                      `inmemory://diff/${runId ?? "_"}/${encodeURIComponent(
                        file.filePath
                      )}?side=modified`
                    );
                    const originalModel = monaco.editor.createModel(
                      file.oldContent,
                      language,
                      originalUri
                    );
                    const modifiedModel = monaco.editor.createModel(
                      file.newContent,
                      language,
                      modifiedUri
                    );
                    editor.setModel({
                      original: originalModel,
                      modified: modifiedModel,
                    });
                  } catch {
                    // ignore if monaco not available
                  }
                  const scheduleMeasureAndLayout = () => {
                    if (rafIdRef.current != null) {
                      cancelAnimationFrame(rafIdRef.current);
                    }
                    rafIdRef.current = requestAnimationFrame(() => {
                      const modifiedEditor = editor.getModifiedEditor();
                      const originalEditor = editor.getOriginalEditor();
                      const modifiedContentHeight =
                        modifiedEditor.getContentHeight();
                      const originalContentHeight =
                        originalEditor.getContentHeight();
                      const newHeight = Math.max(
                        120,
                        Math.max(modifiedContentHeight, originalContentHeight) +
                          20
                      );
                      if (containerRef.current) {
                        const current = parseInt(
                          containerRef.current.style.height || "0",
                          10
                        );
                        if (current !== newHeight) {
                          containerRef.current.style.height = `${newHeight}px`;
                        }
                        const width =
                          containerRef.current.clientWidth || undefined;
                        if (typeof width === "number") {
                          editor.layout({ width, height: newHeight });
                          // Double-rAF to ensure Monaco settles after DOM style changes
                          requestAnimationFrame(() => {
                            editor.layout({ width, height: newHeight });
                            if (containerRef.current && !revealedRef.current) {
                              containerRef.current.style.visibility = "visible";
                              revealedRef.current = true;
                            }
                          });
                        } else {
                          editor.layout();
                          requestAnimationFrame(() => {
                            editor.layout();
                            if (containerRef.current && !revealedRef.current) {
                              containerRef.current.style.visibility = "visible";
                              revealedRef.current = true;
                            }
                          });
                        }
                      } else {
                        editor.layout();
                        requestAnimationFrame(() => {
                          editor.layout();
                          if (containerRef.current && !revealedRef.current) {
                            containerRef.current.style.visibility = "visible";
                            revealedRef.current = true;
                          }
                        });
                      }
                    });
                  };
                  const mod = editor.getModifiedEditor();
                  const orig = editor.getOriginalEditor();
                  const d1 = mod.onDidContentSizeChange(
                    scheduleMeasureAndLayout
                  );
                  const d2 = orig.onDidContentSizeChange(
                    scheduleMeasureAndLayout
                  );
                  const d3 = mod.onDidChangeHiddenAreas(
                    scheduleMeasureAndLayout
                  );
                  const d4 = orig.onDidChangeHiddenAreas(
                    scheduleMeasureAndLayout
                  );
                  const d5 = editor.onDidUpdateDiff?.(scheduleMeasureAndLayout);

                  // Observe container size changes to trigger layout
                  if (containerRef.current && !resizeObserverRef.current) {
                    resizeObserverRef.current = new ResizeObserver(() => {
                      scheduleMeasureAndLayout();
                    });
                    resizeObserverRef.current.observe(containerRef.current);
                  }

                  // Kick initial layout after mount using rAF
                  requestAnimationFrame(() => {
                    scheduleMeasureAndLayout();
                  });
                  return () => {
                    d1.dispose();
                    d2.dispose();
                    d3.dispose();
                    d4.dispose();
                    d5?.dispose?.();
                    if (rafIdRef.current != null) {
                      cancelAnimationFrame(rafIdRef.current);
                      rafIdRef.current = null;
                    }
                    if (resizeObserverRef.current) {
                      resizeObserverRef.current.disconnect();
                      resizeObserverRef.current = null;
                    }
                    diffEditorRef.current = null;
                    // Dispose models we created to avoid leaks and reuse
                    try {
                      const model = editor.getModel();
                      if (model?.original) {
                        model.original.dispose?.();
                      }
                      if (model?.modified) {
                        model.modified.dispose?.();
                      }
                    } catch (_e) {
                      // ignore if monaco not available
                    }
                  };
                }}
                options={{
                  readOnly: true,
                  renderSideBySide: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 12,
                  lineHeight: 18,
                  fontFamily:
                    "'JetBrains Mono', 'SF Mono', Monaco, 'Courier New', monospace",
                  wordWrap: "on",
                  automaticLayout: false,
                  renderOverviewRuler: false,
                  scrollbar: {
                    vertical: "hidden",
                    horizontal: "auto",
                    verticalScrollbarSize: 8,
                    horizontalScrollbarSize: 8,
                    handleMouseWheel: true,
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
                  lineDecorationsWidth: 12,
                  lineNumbersMinChars: 4,
                  glyphMargin: reviewMode,
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
              {/* Inline comment toolbar when selecting lines in review mode */}
              {reviewMode && pendingComment && (
                <div
                  className="absolute z-20"
                  style={{ top: pendingComment.topPx + 2, right: 8 }}
                >
                  <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 shadow-sm rounded-md p-2 w-[320px]">
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 select-none">
                      Comment on line{pendingComment.startLine === pendingComment.endLine ? "" : "s"}
                      {" "}
                      <span className="font-mono text-neutral-700 dark:text-neutral-300">
                        {pendingComment.startLine}
                        {pendingComment.endLine !== pendingComment.startLine && `–${pendingComment.endLine}`}
                      </span>
                    </div>
                    <textarea
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      placeholder="Leave a comment"
                      className="w-full h-20 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 text-neutral-900 dark:text-neutral-100 outline-none resize-none"
                    />
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button
                        className="px-2 py-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                        onClick={() => {
                          setPendingComment(null);
                          setCommentDraft("");
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="px-2 py-1 text-xs rounded bg-[#1f883d] text-white border border-[#1a7f37] hover:bg-[#187436] disabled:opacity-60"
                        onClick={() => {
                          if (!diffEditorRef.current || !pendingComment) return;
                          const newComment = {
                            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                            startLine: pendingComment.startLine,
                            endLine: pendingComment.endLine,
                            text: commentDraft.trim(),
                          };
                          if (!newComment.text) return;
                          setComments((prev) => [...prev, newComment]);
                          // Add decoration for commented lines
                          try {
                            const monacoEditor = diffEditorRef.current.getModifiedEditor();
                            const model = monacoEditor.getModel();
                            if (model) {
                              const decorations = monacoEditor.deltaDecorations(
                                [],
                                [
                                  {
                                    range: {
                                      startLineNumber: newComment.startLine,
                                      startColumn: 1,
                                      endLineNumber: newComment.endLine,
                                      endColumn: 1,
                                    },
                                    options: {
                                      isWholeLine: true,
                                      className: "cmux-comment-line",
                                      linesDecorationsClassName: "cmux-comment-glyph",
                                    },
                                  },
                                ]
                              );
                              decorationsRef.current = [
                                ...decorationsRef.current,
                                ...decorations,
                              ];
                            }
                          } catch {
                            // ignore
                          }
                          setPendingComment(null);
                          setCommentDraft("");
                        }}
                        disabled={!commentDraft.trim()}
                      >
                        Add comment
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Existing comments list for this file */}
              {comments.length > 0 && (
                <div className="px-3 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/50">
                  <div className="space-y-3">
                    {comments.map((c) => (
                      <div key={c.id} className="border border-neutral-200 dark:border-neutral-800 rounded-md overflow-hidden">
                        <div className="px-3 py-2 bg-white dark:bg-neutral-900 flex items-center justify-between">
                          <div className="text-xs text-neutral-500 dark:text-neutral-400 select-none">
                            Lines {c.startLine}
                            {c.endLine !== c.startLine ? `–${c.endLine}` : ""}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              className="text-xs px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                              onClick={() => {
                                const ed = diffEditorRef.current?.getModifiedEditor();
                                if (ed) {
                                  ed.revealLineInCenter(c.startLine, 0);
                                }
                              }}
                            >
                              Jump to
                            </button>
                            <button
                              className="text-xs px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-700 text-red-700 dark:text-red-400 hover:bg-red-50/70 dark:hover:bg-red-900/20"
                              onClick={() => {
                                const nextList = comments.filter((x) => x.id !== c.id);
                                setComments(nextList);
                                // Note: For simplicity, we don't track per-comment decoration ID; we clear and re-render all decorations.
                                try {
                                  const ed = diffEditorRef.current?.getModifiedEditor();
                                  const model = ed?.getModel();
                                  if (ed && model) {
                                    if (decorationsRef.current.length) {
                                      ed.deltaDecorations(decorationsRef.current, []);
                                      decorationsRef.current = [];
                                    }
                                    const remaining = nextList.map((x) => ({
                                      range: {
                                        startLineNumber: x.startLine,
                                        startColumn: 1,
                                        endLineNumber: x.endLine,
                                        endColumn: 1,
                                      },
                                      options: {
                                        isWholeLine: true,
                                        className: "cmux-comment-line",
                                        linesDecorationsClassName: "cmux-comment-glyph",
                                      },
                                    }));
                                    if (remaining.length) {
                                      const ids = ed.deltaDecorations([], remaining);
                                      decorationsRef.current = ids;
                                    }
                                  }
                                } catch {
                                  // ignore
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <div className="px-3 py-2 bg-neutral-50 dark:bg-neutral-950 text-sm text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap">
                          {c.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const MemoFileDiffRow = memo(FileDiffRow, (prev, next) => {
  const a = prev.file;
  const b = next.file;
  return (
    prev.isExpanded === next.isExpanded &&
    prev.theme === next.theme &&
    prev.reviewMode === next.reviewMode &&
    a.filePath === b.filePath &&
    a.status === b.status &&
    a.additions === b.additions &&
    a.deletions === b.deletions &&
    a.isBinary === b.isBinary &&
    (a.patch || "") === (b.patch || "") &&
    a.oldContent === b.oldContent &&
    a.newContent === b.newContent
  );
});

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
