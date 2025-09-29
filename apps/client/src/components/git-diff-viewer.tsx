import { useTheme } from "@/components/theme/use-theme";
import { isElectron } from "@/lib/electron";
import { cn } from "@/lib/utils";
import type { ReplaceDiffEntry } from "@cmux/shared/diff-types";
import {
  ChevronDown,
  ChevronRight,
  FileCode,
  FileEdit,
  FileMinus,
  FilePlus,
  FileText,
} from "lucide-react";
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  lineNumbers,
} from "@codemirror/view";
import { MergeView } from "@codemirror/merge";
import { StreamLanguage } from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { css as cssLanguage } from "@codemirror/lang-css";
import { html as htmlLanguage } from "@codemirror/lang-html";
import { markdown } from "@codemirror/lang-markdown";
import { sql } from "@codemirror/lang-sql";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { go as goLanguage } from "@codemirror/lang-go";
import { java as javaLanguage } from "@codemirror/lang-java";
import { php as phpLanguage } from "@codemirror/lang-php";
import { xml as xmlLanguage } from "@codemirror/lang-xml";
import { yaml as yamlLanguage } from "@codemirror/lang-yaml";
import { cpp } from "@codemirror/lang-cpp";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import {
  c as clikeC,
  csharp as clikeCsharp,
  kotlin as clikeKotlin,
  scala as clikeScala,
} from "@codemirror/legacy-modes/mode/clike";
import { ruby as rubyLanguage } from "@codemirror/legacy-modes/mode/ruby";
import { swift as swiftLanguage } from "@codemirror/legacy-modes/mode/swift";
import { dockerFile as dockerfileLanguage } from "@codemirror/legacy-modes/mode/dockerfile";
import { sass as legacySass } from "@codemirror/legacy-modes/mode/sass";
import { toml as tomlLanguage } from "@codemirror/legacy-modes/mode/toml";
import { kitties } from "./kitties";

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

function debugGitDiffViewerLog(
  message: string,
  payload?: Record<string, unknown>
) {
  if (!isElectron && import.meta.env.PROD) {
    return;
  }
  if (payload) {
    console.info("[git-diff-viewer]", message, payload);
  } else {
    console.info("[git-diff-viewer]", message);
  }
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

  // Maintain expansion state across refreshes:
  // - On first load: expand all
  // - On subsequent diffs changes: preserve existing expansions, expand only truly new files
  //   (detected via previous file list, not by expansion set)
  const prevFilesRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const nextPathsArr = diffs.map((d) => d.filePath);
    const nextPaths = new Set(nextPathsArr);
    debugGitDiffViewerLog("recomputing expanded files", {
      incomingCount: nextPaths.size,
      previousCount: prevFilesRef.current?.size ?? 0,
    });
    setExpandedFiles((prev) => {
      // First load: expand everything
      if (prevFilesRef.current == null) {
        debugGitDiffViewerLog("initial expansion state", {
          expandedCount: nextPaths.size,
        });
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
      debugGitDiffViewerLog("updated expansion state", {
        expandedCount: next.size,
      });
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
      debugGitDiffViewerLog("toggled file", {
        filePath,
        expanded: !wasExpanded,
      });
      try {
        onFileToggle?.(filePath, !wasExpanded);
      } catch {
        // ignore
      }
      return newExpanded;
    });
  };

  const expandAll = () => {
    debugGitDiffViewerLog("expandAll invoked", {
      fileCount: fileGroups.length,
    });
    setExpandedFiles(new Set(fileGroups.map((f) => f.filePath)));
  };

  const collapseAll = () => {
    debugGitDiffViewerLog("collapseAll invoked", {
      fileCount: fileGroups.length,
    });
    setExpandedFiles(new Set());
  };

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
  classNames,
}: FileDiffRowProps) {
  const mergeHostRef = useRef<HTMLDivElement | null>(null);
  const mergeViewRef = useRef<MergeView | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const [minimumHeight, setMinimumHeight] = useState(() =>
    Math.max(120, calculateEditorHeight(file.oldContent, file.newContent))
  );

  const shouldRenderEditor =
    isExpanded &&
    !file.isBinary &&
    file.status !== "deleted" &&
    file.status !== "renamed";

  const baseExtensions = useMemo(() => createBaseExtensions(theme), [theme]);

  const languageExtensions = useMemo(
    () => getLanguageExtensions(file.filePath),
    [file.filePath]
  );

  useLayoutEffect(() => {
    if (!shouldRenderEditor) {
      return;
    }
    const nextHeight = Math.max(
      120,
      calculateEditorHeight(file.oldContent, file.newContent)
    );
    setMinimumHeight((prev) => (prev === nextHeight ? prev : nextHeight));
  }, [
    shouldRenderEditor,
    file.oldContent,
    file.newContent,
    calculateEditorHeight,
  ]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current != null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!shouldRenderEditor) {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (mergeViewRef.current) {
        mergeViewRef.current.destroy();
        mergeViewRef.current = null;
      }
      if (mergeHostRef.current) {
        mergeHostRef.current.textContent = "";
      }
      setIsEditorVisible(false);
      return;
    }

    const host = mergeHostRef.current;
    if (!host) {
      return;
    }

    host.textContent = "";
    setIsEditorVisible(false);

    const extensions = [...baseExtensions, ...languageExtensions];

    const merge = new MergeView({
      a: {
        doc: file.oldContent ?? "",
        extensions: [...extensions],
      },
      b: {
        doc: file.newContent ?? "",
        extensions: [...extensions],
      },
      parent: host,
      highlightChanges: true,
      gutter: true,
      collapseUnchanged: {
        margin: 3,
        minSize: 6,
      },
      diffConfig: {
        scanLimit: 500,
        timeout: 1500,
      },
    });

    mergeViewRef.current = merge;

    const measure = () => {
      const dom = merge.dom;
      const height = dom.getBoundingClientRect().height;
      if (!Number.isFinite(height) || height <= 0) {
        return;
      }
      const next = Math.max(120, Math.ceil(height) + 12);
      setMinimumHeight((prev) => (prev === next ? prev : next));
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(merge.dom);
    resizeObserverRef.current = observer;

    animationFrameRef.current = requestAnimationFrame(() => {
      setIsEditorVisible(true);
      animationFrameRef.current = null;
    });

    debugGitDiffViewerLog("merge editor mounted", {
      filePath: file.filePath,
      collapseUnchanged: true,
    });

    return () => {
      if (animationFrameRef.current != null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      observer.disconnect();
      resizeObserverRef.current = null;
      merge.destroy();
      mergeViewRef.current = null;
      host.textContent = "";
      setIsEditorVisible(false);
      debugGitDiffViewerLog("merge editor cleaned up", {
        filePath: file.filePath,
      });
    };
  }, [
    shouldRenderEditor,
    file.oldContent,
    file.newContent,
    baseExtensions,
    languageExtensions,
    file.filePath,
  ]);

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
            <div
              className="relative"
              style={{
                minHeight: minimumHeight,
                visibility: isEditorVisible ? "visible" : "hidden",
              }}
            >
              <div ref={mergeHostRef} className="h-full" />
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

function createBaseExtensions(theme: string | undefined): Extension[] {
  const isDark = theme === "dark";
  const textColor = isDark ? "#e5e7eb" : "#1f2937";
  const gutterColor = isDark ? "#9ca3af" : "#6b7280";

  const baseTheme = EditorView.theme(
    {
      "&": {
        fontFamily:
          "'JetBrains Mono', 'SF Mono', Monaco, 'Courier New', monospace",
        fontSize: "12px",
        lineHeight: "18px",
        backgroundColor: "transparent",
        color: textColor,
      },
      ".cm-scroller": {
        fontFamily:
          "'JetBrains Mono', 'SF Mono', Monaco, 'Courier New', monospace",
        lineHeight: "18px",
      },
      ".cm-content": {
        padding: "2px 0",
      },
      ".cm-gutters": {
        backgroundColor: "transparent",
        border: "none",
        color: gutterColor,
      },
      ".cm-gutterElement": {
        padding: "0 8px",
      },
      ".cm-lineNumbers .cm-gutterElement": {
        fontSize: "11px",
      },
      ".cm-activeLine": {
        backgroundColor: isDark
          ? "rgba(255, 255, 255, 0.04)"
          : "rgba(15, 23, 42, 0.04)",
      },
      ".cm-activeLineGutter": {
        backgroundColor: "transparent",
        color: isDark ? "#d4d4d8" : "#4b5563",
      },
      ".cm-selectionBackground, & ::selection": {
        backgroundColor: "rgba(148, 163, 184, 0.35)",
      },
      ".cm-mergeView": {
        backgroundColor: "transparent",
      },
      ".cm-mergeView .cm-editor": {
        backgroundColor: "transparent",
      },
      ".cm-change.cm-change-insert": {
        backgroundColor: isDark
          ? "rgba(34, 197, 94, 0.18)"
          : "rgba(34, 197, 94, 0.16)",
      },
      ".cm-change.cm-change-delete": {
        backgroundColor: isDark
          ? "rgba(248, 113, 113, 0.18)"
          : "rgba(248, 113, 113, 0.16)",
      },
      ".cm-panels": {
        backgroundColor: "transparent",
      },
      ".cm-mergeView .cm-panels": {
        backgroundColor: "transparent",
      },
    },
    { dark: isDark }
  );

  return [
    EditorState.readOnly.of(true),
    EditorView.editable.of(false),
    EditorView.lineWrapping,
    highlightActiveLine(),
    highlightActiveLineGutter(),
    lineNumbers(),
    baseTheme,
  ];
}

function getLanguageExtensions(path: string): Extension[] {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
      return [javascript({ typescript: true })];
    case "tsx":
      return [javascript({ typescript: true, jsx: true })];
    case "js":
      return [javascript()];
    case "jsx":
      return [javascript({ jsx: true })];
    case "json":
      return [json()];
    case "md":
    case "markdown":
      return [markdown()];
    case "css":
      return [cssLanguage()];
    case "scss":
    case "sass":
      return [StreamLanguage.define(legacySass)];
    case "html":
    case "htm":
      return [htmlLanguage()];
    case "xml":
      return [xmlLanguage()];
    case "yaml":
    case "yml":
      return [yamlLanguage()];
    case "py":
      return [python()];
    case "rs":
      return [rust()];
    case "go":
      return [goLanguage()];
    case "java":
      return [javaLanguage()];
    case "php":
      return [phpLanguage()];
    case "sql":
      return [sql()];
    case "rb":
      return [StreamLanguage.define(rubyLanguage)];
    case "swift":
      return [StreamLanguage.define(swiftLanguage)];
    case "kt":
    case "kts":
      return [StreamLanguage.define(clikeKotlin)];
    case "scala":
      return [StreamLanguage.define(clikeScala)];
    case "cs":
    case "csharp":
      return [StreamLanguage.define(clikeCsharp)];
    case "c":
    case "h":
      return [StreamLanguage.define(clikeC)];
    case "cpp":
    case "cxx":
    case "cc":
    case "hpp":
    case "hxx":
    case "hh":
      return [cpp()];
    case "sh":
    case "bash":
    case "zsh":
      return [StreamLanguage.define(shell)];
    case "toml":
      return [StreamLanguage.define(tomlLanguage)];
    case "dockerfile":
    case "docker":
      return [StreamLanguage.define(dockerfileLanguage)];
    default:
      return [];
  }
}
