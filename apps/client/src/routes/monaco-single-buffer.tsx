import { createFileRoute } from "@tanstack/react-router";
import { DiffEditor, type DiffOnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { useTheme } from "@/components/theme/use-theme";
import { loaderInitPromise } from "@/lib/monaco-environment";

type DiffLineKind = "context" | "add" | "remove";

type DiffLine = {
  kind: DiffLineKind;
  content: string;
  originalLineNumber?: number;
  modifiedLineNumber?: number;
};

type DiffHunk = {
  originalStartLine: number;
  modifiedStartLine: number;
  lines: DiffLine[];
};

type FileDiff = {
  filePath: string;
  hunks: DiffHunk[];
};

type CombinedFileBoundary = {
  filePath: string;
  startLineNumber: number;
};

type CombinedDiffOutput = {
  originalText: string;
  modifiedText: string;
  originalLineNumbers: (number | null)[];
  modifiedLineNumbers: (number | null)[];
  fileBoundaries: CombinedFileBoundary[];
};

type HeaderOverlayItem = {
  id: string;
  filePath: string;
  y: number;
};

type HeaderOverlayColumnState = {
  left: number;
  width: number;
  items: HeaderOverlayItem[];
};

type HeaderColumnOverlayProps = {
  state: HeaderOverlayColumnState;
  theme: string;
  side: "original" | "modified";
};

const syntheticFilePaths = [
  "apps/server/src/routes/session.ts",
  "apps/server/src/config/env.ts",
  "apps/client/src/components/editor-tabs.tsx",
  "apps/client/src/routes/_layout.$teamSlugOrId.task.$taskId.tsx",
  "packages/ui/button.tsx",
  "packages/utils/duration.ts",
  "packages/utils/diff-builder.ts",
  "scripts/dev.sh",
  "packages/convex/src/tasks.ts",
  "apps/www/lib/routes/agents.ts",
] as const;

const multiFileDiffExample: FileDiff[] = syntheticFilePaths.map((filePath, fileIndex) => ({
  filePath,
  hunks: [
    createSyntheticHunk(filePath, fileIndex, 0),
    createSyntheticHunk(filePath, fileIndex, 1),
  ],
}));

const FILE_LABEL_ZONE_HEIGHT = 32;

export const Route = createFileRoute("/monaco-single-buffer")({
  component: MonacoSingleBufferRoute,
});

function MonacoSingleBufferRoute() {
  const { theme } = useTheme();
  const [isReady, setIsReady] = useState(false);
  const overlayRootRef = useRef<HTMLDivElement | null>(null);
  const [originalOverlay, setOriginalOverlay] = useState<HeaderOverlayColumnState | null>(null);
  const [modifiedOverlay, setModifiedOverlay] = useState<HeaderOverlayColumnState | null>(null);

  useEffect(() => {
    let cancelled = false;
    loaderInitPromise
      .then(() => {
        if (!cancelled) {
          setIsReady(true);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to initialize Monaco", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const diffData = useMemo(() => multiFileDiffExample, []);
  const combinedDiff = useMemo<CombinedDiffOutput>(() => buildCombinedDiff(diffData), [diffData]);

  const editorTheme = theme === "dark" ? "vs-dark" : "vs";

  const diffOptions = useMemo<editor.IDiffEditorConstructionOptions>(
    () => ({
      renderSideBySide: true,
      useInlineViewWhenSpaceIsLimited: false,
      readOnly: true,
      originalEditable: false,
      enableSplitViewResizing: true,
      minimap: { enabled: false },
      renderOverviewRuler: false,
      scrollbar: {
        useShadows: false,
        vertical: "auto",
        horizontal: "auto",
      },
      lineDecorationsWidth: 48,
      lineNumbers: "on",
      wordWrap: "on",
    }),
    [],
  );

  const handleMount: DiffOnMount = (editorInstance, _monacoInstance) => {
    const originalEditor = editorInstance.getOriginalEditor();
    const modifiedEditor = editorInstance.getModifiedEditor();

    originalEditor.updateOptions({
      lineNumbers: (lineNumber) =>
        formatLineNumber(combinedDiff.originalLineNumbers, lineNumber),
    });

    modifiedEditor.updateOptions({
      lineNumbers: (lineNumber) =>
        formatLineNumber(combinedDiff.modifiedLineNumbers, lineNumber),
    });

    const container = overlayRootRef.current;
    if (!container) {
      return;
    }

    const disposeHeaderOverlay = setupHeaderOverlay({
      container,
      boundaries: combinedDiff.fileBoundaries,
      originalEditor,
      modifiedEditor,
      onOriginalUpdate: setOriginalOverlay,
      onModifiedUpdate: setModifiedOverlay,
    });

    editorInstance.onDidDispose(() => {
      disposeHeaderOverlay();
    });
  };

  if (!isReady) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-neutral-100 text-neutral-800 dark:bg-neutral-950 dark:text-neutral-100">
        <span className="text-sm uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
          Loading Monaco diff…
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-100 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="flex flex-col gap-1 border-b border-neutral-200 px-6 py-5 dark:border-neutral-800">
        <h1 className="text-2xl font-semibold">Monaco Multi-file Diff Sandbox</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Visualize 10 synthetic files with 20 hunks collapsed into a single buffer. View zones mark
          file boundaries and content widgets display the file names.
        </p>
      </header>
      <main className="flex flex-1 flex-col gap-4 px-4 py-4 md:px-6 lg:px-8">
        <section className="flex-1 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div ref={overlayRootRef} className="relative h-[80vh]">
            {originalOverlay ? (
              <HeaderColumnOverlay state={originalOverlay} theme={theme} side="original" />
            ) : null}
            {modifiedOverlay ? (
              <HeaderColumnOverlay state={modifiedOverlay} theme={theme} side="modified" />
            ) : null}
            <DiffEditor
              key={theme}
              theme={editorTheme}
              options={diffOptions}
              height="100%"
              original={combinedDiff.originalText}
              modified={combinedDiff.modifiedText}
              originalLanguage="plaintext"
              modifiedLanguage="plaintext"
              onMount={handleMount}
            />
          </div>
        </section>
        <section className="rounded-lg border border-dashed border-neutral-300 bg-white/70 p-4 text-xs text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-neutral-400">
          Line numbers reuse the original hunks through a mapping array so the Monaco gutter matches
          real file positions. The view zones reserve {FILE_LABEL_ZONE_HEIGHT}px for each file label
          and the paired content widgets render the filename overlays.
        </section>
      </main>
    </div>
  );
}

function formatLineNumber(map: (number | null)[], lineNumber: number): string {
  const mapped = map[lineNumber - 1];
  if (typeof mapped === "number") {
    return mapped.toString();
  }
  return "";
}

function buildCombinedDiff(diffFiles: FileDiff[]): CombinedDiffOutput {
  const originalLines: string[] = [];
  const modifiedLines: string[] = [];
  const originalNumbers: (number | null)[] = [];
  const modifiedNumbers: (number | null)[] = [];
  const fileBoundaries: CombinedFileBoundary[] = [];

  let totalLines = 0;

  diffFiles.forEach((fileDiff, fileIndex) => {
    const startLineNumber = totalLines + 1;
    fileBoundaries.push({ filePath: fileDiff.filePath, startLineNumber });

    fileDiff.hunks.forEach((hunk, hunkIndex) => {
      hunk.lines.forEach((line) => {
        switch (line.kind) {
          case "context": {
            originalLines.push(line.content);
            modifiedLines.push(line.content);
            originalNumbers.push(line.originalLineNumber ?? null);
            modifiedNumbers.push(line.modifiedLineNumber ?? null);
            totalLines += 1;
            break;
          }
          case "remove": {
            originalLines.push(line.content);
            modifiedLines.push("");
            originalNumbers.push(line.originalLineNumber ?? null);
            modifiedNumbers.push(null);
            totalLines += 1;
            break;
          }
          case "add": {
            originalLines.push("");
            modifiedLines.push(line.content);
            originalNumbers.push(null);
            modifiedNumbers.push(line.modifiedLineNumber ?? null);
            totalLines += 1;
            break;
          }
        }
      });

      if (hunkIndex < fileDiff.hunks.length - 1) {
        originalLines.push("");
        modifiedLines.push("");
        originalNumbers.push(null);
        modifiedNumbers.push(null);
        totalLines += 1;
      }
    });

    if (fileIndex < diffFiles.length - 1) {
      originalLines.push("");
      modifiedLines.push("");
      originalNumbers.push(null);
      modifiedNumbers.push(null);
      totalLines += 1;
    }
  });

  return {
    originalText: originalLines.join("\n"),
    modifiedText: modifiedLines.join("\n"),
    originalLineNumbers: originalNumbers,
    modifiedLineNumbers: modifiedNumbers,
    fileBoundaries,
  };
}

type SetupHeaderOverlayParams = {
  container: HTMLElement;
  originalEditor: editor.ICodeEditor;
  modifiedEditor: editor.ICodeEditor;
  boundaries: CombinedFileBoundary[];
  onOriginalUpdate: (state: HeaderOverlayColumnState | null) => void;
  onModifiedUpdate: (state: HeaderOverlayColumnState | null) => void;
};

function setupHeaderOverlay({
  container,
  originalEditor,
  modifiedEditor,
  boundaries,
  onOriginalUpdate,
  onModifiedUpdate,
}: SetupHeaderOverlayParams) {
  if (boundaries.length === 0) {
    onOriginalUpdate(null);
    onModifiedUpdate(null);
    return () => {};
  }

  const disposeOriginal = createOverlayColumn({
    container,
    editor: originalEditor,
    boundaries,
    side: "original",
    onUpdate: onOriginalUpdate,
  });

  const disposeModified = createOverlayColumn({
    container,
    editor: modifiedEditor,
    boundaries,
    side: "modified",
    onUpdate: onModifiedUpdate,
  });

  return () => {
    disposeOriginal();
    disposeModified();
  };
}

type OverlayColumnOptions = {
  container: HTMLElement;
  editor: editor.ICodeEditor;
  boundaries: CombinedFileBoundary[];
  side: "original" | "modified";
  onUpdate: (state: HeaderOverlayColumnState | null) => void;
};

function createOverlayColumn({
  container,
  editor,
  boundaries,
  side,
  onUpdate,
}: OverlayColumnOptions): () => void {
  const zoneIds: string[] = [];
  const zoneNodes: HTMLElement[] = [];

  editor.changeViewZones((accessor) => {
    boundaries.forEach((boundary, index) => {
      const domNode = document.createElement("div");
      domNode.style.height = `${FILE_LABEL_ZONE_HEIGHT}px`;
      domNode.style.width = "100%";
      domNode.style.pointerEvents = "none";
      domNode.style.background = "transparent";

      const zoneId = accessor.addZone({
        afterLineNumber: Math.max(boundary.startLineNumber - 1, 0),
        domNode,
        heightInPx: FILE_LABEL_ZONE_HEIGHT,
      });

      zoneIds.push(zoneId);
      zoneNodes[index] = domNode;
    });
  });

  let rafToken: number | null = null;

  const scheduleUpdate = () => {
    if (rafToken !== null) {
      cancelAnimationFrame(rafToken);
    }
    rafToken = requestAnimationFrame(() => {
      rafToken = null;
      compute();
    });
  };

  const compute = () => {
    const editorDom = editor.getDomNode();
    if (!editorDom) {
      onUpdate(null);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const editorRect = editorDom.getBoundingClientRect();

    const items: HeaderOverlayItem[] = [];

    zoneNodes.forEach((node, index) => {
      if (!node) {
        return;
      }

      const rect = node.getBoundingClientRect();
      if (Number.isNaN(rect.top)) {
        return;
      }

      let y = rect.top - containerRect.top;
      if (y < 0) {
        y = 0;
      }

      const nextNode = zoneNodes[index + 1];
      if (nextNode) {
        const nextRect = nextNode.getBoundingClientRect();
        const maxY = nextRect.top - containerRect.top - FILE_LABEL_ZONE_HEIGHT;
        if (Number.isFinite(maxY)) {
          y = Math.min(y, Math.max(maxY, 0));
        }
      }

      items.push({
        id: `${side}-${index}`,
        filePath: boundaries[index].filePath,
        y,
      });
    });

    onUpdate({
      left: editorRect.left - containerRect.left,
      width: editorRect.width,
      items,
    });
  };

  const disposables = [
    editor.onDidScrollChange(scheduleUpdate),
    editor.onDidLayoutChange(scheduleUpdate),
    editor.onDidContentSizeChange(scheduleUpdate),
  ];

  const resizeObserver = new ResizeObserver(scheduleUpdate);
  resizeObserver.observe(container);
  zoneNodes.forEach((node) => {
    if (node) {
      resizeObserver.observe(node);
    }
  });

  scheduleUpdate();

  return () => {
    if (rafToken !== null) {
      cancelAnimationFrame(rafToken);
      rafToken = null;
    }

    resizeObserver.disconnect();
    disposables.forEach((disposable) => disposable.dispose());

    editor.changeViewZones((accessor) => {
      zoneIds.forEach((zoneId) => accessor.removeZone(zoneId));
    });

    onUpdate(null);
  };
}

function getLabelStyle(theme: string, side: "original" | "modified"): CSSProperties {
  return {
    height: `${FILE_LABEL_ZONE_HEIGHT}px`,
    display: "flex",
    alignItems: "center",
    justifyContent: side === "original" ? "flex-end" : "flex-start",
    padding: side === "original" ? "0 12px 0 24px" : "0 24px 0 12px",
    fontFamily: '"JetBrains Mono", "Fira Code", "SFMono-Regular", monospace',
    fontSize: "12px",
    letterSpacing: "0.02em",
    textTransform: "uppercase",
    fontWeight: 600,
    borderRadius: side === "original" ? "0 8px 8px 0" : "8px 0 0 8px",
    border: theme === "dark" ? "1px solid #3f3f46" : "1px solid #d4d4d8",
    background: theme === "dark" ? "rgba(32,32,36,0.92)" : "rgba(248,248,249,0.95)",
    color: theme === "dark" ? "#e5e5e5" : "#1f2937",
    boxSizing: "border-box",
    boxShadow:
      theme === "dark"
        ? "0 1px 3px rgba(0,0,0,0.4)"
        : "0 1px 3px rgba(15,23,42,0.12)",
    pointerEvents: "none",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    width: "100%",
  };
}

function HeaderColumnOverlay({ state, theme, side }: HeaderColumnOverlayProps) {
  const baseStyle = getLabelStyle(theme, side);
  return (
    <div
      className="pointer-events-none absolute top-0"
      style={{ left: state.left, width: state.width, height: "100%", zIndex: 40 }}
    >
      {state.items.map((item) => (
        <div
          key={item.id}
          style={{
            ...baseStyle,
            position: "absolute",
            transform: `translateY(${item.y}px)`,
          }}
        >
          {item.filePath}
        </div>
      ))}
    </div>
  );
}

function createSyntheticHunk(filePath: string, fileIndex: number, hunkIndex: number): DiffHunk {
  const offset = fileIndex * 30 + hunkIndex * 12;
  const originalStartLine = 20 + offset;
  const modifiedStartLine = 21 + offset;

  const lines: DiffLine[] = [];
  let originalLinePointer = originalStartLine;
  let modifiedLinePointer = modifiedStartLine;

  const functionName = createFunctionIdentifier(filePath, hunkIndex);

  lines.push(
    createContextLine(
      `function ${functionName}(agentId: string) {`,
      originalLinePointer++,
      modifiedLinePointer++,
    ),
  );
  lines.push(
    createContextLine(
      `  const scopeKey = "${fileIndex}-${hunkIndex}-" + agentId;`,
      originalLinePointer++,
      modifiedLinePointer++,
    ),
  );
  lines.push(createRemoveLine(`  const cached = cache.get(scopeKey);`, originalLinePointer++));
  lines.push(
    createAddLine(
      "  const cached = cache.resolve(scopeKey, { hydrate: true });",
      modifiedLinePointer++,
    ),
  );
  lines.push(
    createContextLine("  if (!cached) {", originalLinePointer++, modifiedLinePointer++),
  );
  lines.push(
    createAddLine("    logger.info('hydrated scope', scopeKey);", modifiedLinePointer++),
  );
  lines.push(createContextLine("  }", originalLinePointer++, modifiedLinePointer++));
  lines.push(createRemoveLine("  return fallbackValue;", originalLinePointer++));
  lines.push(
    createAddLine(
      `  return computeNext(scopeKey, cached, ${fileIndex + hunkIndex});`,
      modifiedLinePointer++,
    ),
  );
  lines.push(createContextLine("}", originalLinePointer++, modifiedLinePointer++));

  return {
    originalStartLine,
    modifiedStartLine,
    lines,
  };
}

function createFunctionIdentifier(filePath: string, hunkIndex: number): string {
  const fileName = filePath.split("/").pop() ?? "File";
  const sanitized = fileName.replace(/[^a-zA-Z0-9]/g, "");
  const fallback = sanitized.length > 0 ? sanitized : "File";
  return `resolve${fallback}${hunkIndex}`;
}

function createContextLine(content: string, originalLineNumber: number, modifiedLineNumber: number): DiffLine {
  return {
    kind: "context",
    content,
    originalLineNumber,
    modifiedLineNumber,
  };
}

function createAddLine(content: string, modifiedLineNumber: number): DiffLine {
  return {
    kind: "add",
    content,
    modifiedLineNumber,
  };
}

function createRemoveLine(content: string, originalLineNumber: number): DiffLine {
  return {
    kind: "remove",
    content,
    originalLineNumber,
  };
}
