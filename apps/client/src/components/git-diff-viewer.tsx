import { useTheme } from "@/components/theme/use-theme";
import { cn } from "@/lib/utils";
import type { ReplaceDiffEntry } from "@cmux/shared/diff-types";
import loader from "@monaco-editor/loader";
import {
  ChevronDown,
  ChevronRight,
  FileCode,
  FileEdit,
  FileMinus,
  FilePlus,
  FileText,
} from "lucide-react";
import * as monaco from "monaco-editor";
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
import { kitties } from "./kitties";

loader.config({
  monaco,
});
const loaderInitPromise = new Promise<typeof monaco>((resolve) => {
  loader.init().then(resolve);
});

type FileDiffRowClassNames = {
  button?: string;
  container?: string;
};

type GitDiffViewerClassNames = {
  fileDiffRow?: FileDiffRowClassNames;
};

export interface GitDiffViewerProps {
  diffs: ReplaceDiffEntry[];
  onControlsChange?: (controls: {
    expandAll: () => void;
    collapseAll: () => void;
    totalAdditions: number;
    totalDeletions: number;
  }) => void;
  classNames?: GitDiffViewerClassNames;
  onFileToggle?: (filePath: string, isExpanded: boolean) => void;
}

type FileGroup = {
  filePath: string;
  oldPath?: string;
  status: ReplaceDiffEntry["status"];
  additions: number;
  deletions: number;
  oldContent: string;
  newContent: string;
  patch?: string;
  isBinary: boolean;
};

type Disposable = { dispose: () => void };

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

export function GitDiffViewer({
  diffs,
  onControlsChange,
  classNames,
  onFileToggle,
}: GitDiffViewerProps) {
  const { theme } = useTheme();

  const kitty = useMemo(() => {
    return kitties[Math.floor(Math.random() * kitties.length)];
  }, []);

  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const editorRefs = useRef<Record<string, editor.IStandaloneDiffEditor>>({});

  // Group diffs by file
  const fileGroups: FileGroup[] = useMemo(
    () =>
      (diffs || []).map((diff) => ({
        filePath: diff.filePath,
        oldPath: diff.oldPath,
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
      try {
        onFileToggle?.(filePath, !wasExpanded);
      } catch {
        // ignore
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

  // No per-run cache in refs mode

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

  return (
    <div className="grow bg-white dark:bg-neutral-900">
      {/* Diff sections */}
      <div className="">
        {fileGroups.map((file) => (
          <MemoFileDiffRow
            key={`refs:${file.filePath}`}
            file={file}
            isExpanded={expandedFiles.has(file.filePath)}
            onToggle={() => toggleFile(file.filePath)}
            theme={theme}
            calculateEditorHeight={calculateEditorHeight}
            setEditorRef={(ed) => {
              const key = `refs:${file.filePath}`;
              if (ed) {
                editorRefs.current[key] = ed;
              } else {
                delete editorRefs.current[key];
              }
            }}
            classNames={classNames?.fileDiffRow}
          />
        ))}

        <hr className="border-neutral-200 dark:border-neutral-800" />

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
  setEditorRef: (ed: editor.IStandaloneDiffEditor | null) => void;
  runId?: string;
  classNames?: {
    button?: string;
    container?: string;
  };
}

function FileDiffRow({
  file,
  isExpanded,
  onToggle,
  theme,
  calculateEditorHeight,
  setEditorRef,
  runId,
  classNames,
}: FileDiffRowProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const revealedRef = useRef<boolean>(false);
  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  const disposablesRef = useRef<Disposable[]>([]);
  const originalModelRef = useRef<editor.ITextModel | null>(null);
  const modifiedModelRef = useRef<editor.ITextModel | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const setEditorRefRef = useRef(setEditorRef);
  const themeRef = useRef(theme);

  const disposeEditor = useCallback(() => {
    for (const disposable of disposablesRef.current) {
      try {
        disposable.dispose();
      } catch {
        // ignore
      }
    }
    disposablesRef.current = [];
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    if (diffEditorRef.current) {
      diffEditorRef.current.dispose();
      diffEditorRef.current = null;
    }
    if (originalModelRef.current) {
      originalModelRef.current.dispose();
      originalModelRef.current = null;
    }
    if (modifiedModelRef.current) {
      modifiedModelRef.current.dispose();
      modifiedModelRef.current = null;
    }
    const container = containerRef.current;
    if (container) {
      try {
        container.replaceChildren();
      } catch {
        container.textContent = "";
      }
      container.style.visibility = "hidden";
    }
    revealedRef.current = false;
    try {
      setEditorRefRef.current?.(null);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setEditorRefRef.current = setEditorRef;
  }, [setEditorRef]);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  // Set an initial height before paint to reduce flicker
  useLayoutEffect(() => {
    const initial = calculateEditorHeight(file.oldContent, file.newContent);
    if (containerRef.current) {
      containerRef.current.style.height = `${Math.max(120, initial)}px`;
    }
    // Only depend on file contents used for initial sizing
  }, [file.oldContent, file.newContent, calculateEditorHeight]);

  useEffect(() => {
    let cancelled = false;

    if (!isExpanded || file.isBinary || file.status === "deleted") {
      disposeEditor();
      return () => {
        cancelled = true;
        disposeEditor();
      };
    }

    if (containerRef.current) {
      containerRef.current.style.visibility = "hidden";
    }
    revealedRef.current = false;

    const initializeEditor = async () => {
      try {
        const monaco = await loaderInitPromise;
        if (cancelled || !containerRef.current) {
          return;
        }

        monacoRef.current = monaco;

        const resolvedTheme = themeRef.current === "dark" ? "vs-dark" : "vs";
        try {
          monaco.editor.setTheme(resolvedTheme);
        } catch {
          // ignore if Monaco theme cannot be set
        }

        const options: editor.IDiffEditorConstructionOptions = {
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
        };

        const diffEditor = monaco.editor.createDiffEditor(
          containerRef.current,
          options
        );
        diffEditorRef.current = diffEditor;
        setEditorRefRef.current?.(diffEditor);

        const language = getLanguageFromPath(file.filePath);
        const encodedPath = encodeURIComponent(file.filePath);
        const baseUri = `inmemory://diff/${runId ?? "_"}/${encodedPath}`;
        const originalUri = monaco.Uri.parse(`${baseUri}?side=original`);
        const modifiedUri = monaco.Uri.parse(`${baseUri}?side=modified`);

        monaco.editor.getModel(originalUri)?.dispose();
        monaco.editor.getModel(modifiedUri)?.dispose();

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

        originalModelRef.current = originalModel;
        modifiedModelRef.current = modifiedModel;

        diffEditor.setModel({
          original: originalModel,
          modified: modifiedModel,
        });

        const scheduleMeasureAndLayout = () => {
          if (rafIdRef.current != null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }
          rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            if (cancelled) {
              return;
            }
            const containerEl = containerRef.current;
            if (!containerEl) {
              return;
            }

            const modifiedEditor = diffEditor.getModifiedEditor();
            const originalEditor = diffEditor.getOriginalEditor();
            const modifiedContentHeight = modifiedEditor.getContentHeight();
            const originalContentHeight = originalEditor.getContentHeight();
            const newHeight = Math.max(
              120,
              Math.max(modifiedContentHeight, originalContentHeight) + 20
            );

            const currentHeight = parseInt(containerEl.style.height || "0", 10);
            if (currentHeight !== newHeight) {
              containerEl.style.height = `${newHeight}px`;
            }

            const reveal = () => {
              const el = containerRef.current;
              if (el && !revealedRef.current) {
                el.style.visibility = "visible";
                revealedRef.current = true;
              }
            };

            const width = containerEl.clientWidth || undefined;
            if (typeof width === "number") {
              diffEditor.layout({ width, height: newHeight });
              requestAnimationFrame(() => {
                if (cancelled) {
                  return;
                }
                diffEditor.layout({ width, height: newHeight });
                reveal();
              });
            } else {
              diffEditor.layout();
              requestAnimationFrame(() => {
                if (cancelled) {
                  return;
                }
                diffEditor.layout();
                reveal();
              });
            }
          });
        };

        const modifiedEditor = diffEditor.getModifiedEditor();
        const originalEditor = diffEditor.getOriginalEditor();
        const disposables: Disposable[] = [
          modifiedEditor.onDidContentSizeChange(scheduleMeasureAndLayout),
          originalEditor.onDidContentSizeChange(scheduleMeasureAndLayout),
          modifiedEditor.onDidChangeHiddenAreas(scheduleMeasureAndLayout),
          originalEditor.onDidChangeHiddenAreas(scheduleMeasureAndLayout),
        ];
        const diffDisposable = diffEditor.onDidUpdateDiff?.(
          scheduleMeasureAndLayout
        );
        if (diffDisposable) {
          disposables.push(diffDisposable);
        }
        disposablesRef.current = disposables;

        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect();
          resizeObserverRef.current = null;
        }
        if (containerRef.current) {
          const observer = new ResizeObserver(() => {
            scheduleMeasureAndLayout();
          });
          observer.observe(containerRef.current);
          resizeObserverRef.current = observer;
        }

        requestAnimationFrame(() => {
          if (!cancelled) {
            scheduleMeasureAndLayout();
          }
        });
      } catch {
        // ignore if monaco fails to load
      }
    };

    initializeEditor();

    return () => {
      cancelled = true;
      disposeEditor();
    };
  }, [
    isExpanded,
    file.filePath,
    file.oldContent,
    file.newContent,
    file.isBinary,
    file.status,
    runId,
    disposeEditor,
  ]);

  useEffect(() => {
    if (!monacoRef.current) {
      return;
    }
    const resolvedTheme = theme === "dark" ? "vs-dark" : "vs";
    try {
      monacoRef.current.editor.setTheme(resolvedTheme);
    } catch {
      // ignore
    }
  }, [theme]);

  // No debug logs in production
  useEffect(() => {
    // noop
  }, [isExpanded, file.filePath]);

  return (
    <div className={cn("bg-white dark:bg-neutral-900", classNames?.container)}>
      <button
        onClick={onToggle}
        className={cn(
          "w-full px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors text-left group pt-1 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 sticky z-[var(--z-sticky-low)]",
          classNames?.button
        )}
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
        <div className="flex-1 min-w-0 flex items-start justify-between gap-3">
          <div className="min-w-0 flex flex-col">
            <span className="font-mono text-xs text-neutral-700 dark:text-neutral-300 truncate select-none">
              {file.filePath}
            </span>
            {file.status === "renamed" && file.oldPath ? (
              <span className="font-mono text-[10px] text-neutral-500 dark:text-neutral-400 truncate select-none">
                Renamed from {file.oldPath}
              </span>
            ) : null}
          </div>
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
          {file.status === "renamed" ? (
            <div className="px-3 py-6 text-center text-neutral-500 dark:text-neutral-400 text-xs bg-neutral-50 dark:bg-neutral-900/50 space-y-2">
              <p className="select-none">File was renamed.</p>
              {file.oldPath ? (
                <p className="font-mono text-[11px] text-neutral-600 dark:text-neutral-300 select-none">
                  {file.oldPath} → {file.filePath}
                </p>
              ) : null}
            </div>
          ) : file.isBinary ? (
            <div className="px-3 py-6 text-center text-neutral-500 dark:text-neutral-400 text-xs bg-neutral-50 dark:bg-neutral-900/50">
              Binary file not shown
            </div>
          ) : file.status === "deleted" ? (
            <div className="px-3 py-6 text-center text-neutral-500 dark:text-neutral-400 text-xs bg-neutral-50 dark:bg-neutral-900/50">
              File was deleted
            </div>
          ) : (
            <div ref={containerRef} className="relative" />
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
    a.filePath === b.filePath &&
    a.oldPath === b.oldPath &&
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
