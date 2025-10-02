import { createFileRoute } from "@tanstack/react-router";
import { DiffEditor, type DiffOnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useEffect, useMemo, useState } from "react";

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

  const handleMount: DiffOnMount = (editorInstance, monacoInstance) => {
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

    const disposeFileBoundaries = applyFileBoundaries({
      originalEditor,
      modifiedEditor,
      monacoInstance,
      boundaries: combinedDiff.fileBoundaries,
      theme,
    });

    editorInstance.onDidDispose(() => {
      disposeFileBoundaries();
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
          <DiffEditor
            key={theme}
            theme={editorTheme}
            options={diffOptions}
            height="80vh"
            original={combinedDiff.originalText}
            modified={combinedDiff.modifiedText}
            originalLanguage="plaintext"
            modifiedLanguage="plaintext"
            onMount={handleMount}
          />
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

type ApplyFileBoundariesParams = {
  originalEditor: editor.ICodeEditor;
  modifiedEditor: editor.ICodeEditor;
  monacoInstance: typeof import("monaco-editor");
  boundaries: CombinedFileBoundary[];
  theme: string;
};

function applyFileBoundaries({
  originalEditor,
  modifiedEditor,
  monacoInstance,
  boundaries,
  theme,
}: ApplyFileBoundariesParams) {
  const originalZoneIds: string[] = [];
  const modifiedZoneIds: string[] = [];
  const widgets: Array<{
    editor: editor.ICodeEditor;
    widget: editor.IContentWidget;
    dispose: () => void;
  }> = [];

  const originalMarginNodes: HTMLElement[] = [];
  const modifiedMarginNodes: HTMLElement[] = [];

  const buildLabel = (label: HTMLElement, side: "original" | "modified") => {
    label.textContent = "";
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.justifyContent = side === "original" ? "flex-end" : "flex-start";
    label.style.fontFamily = '"JetBrains Mono", "Fira Code", "SFMono-Regular", monospace';
    label.style.fontSize = "12px";
    label.style.letterSpacing = "0.02em";
    label.style.textTransform = "uppercase";
    label.style.fontWeight = "600";
    label.style.borderRadius = "8px";
    label.style.border = theme === "dark" ? "1px solid #3f3f46" : "1px solid #d4d4d8";
    label.style.background = theme === "dark" ? "rgba(32,32,36,0.92)" : "rgba(248,248,249,0.95)";
    label.style.color = theme === "dark" ? "#e5e5e5" : "#1f2937";
    label.style.boxSizing = "border-box";
    label.style.boxShadow = theme === "dark"
      ? "0 1px 3px rgba(0,0,0,0.4)"
      : "0 1px 3px rgba(15,23,42,0.12)";
    label.style.pointerEvents = "none";
    label.style.padding = side === "original" ? "0 12px 0 24px" : "0 24px 0 12px";
    label.style.position = "relative";
    label.style.zIndex = "20";
    label.style.willChange = "transform";
  };

  const addZones = (
    targetEditor: editor.ICodeEditor,
    store: string[],
    marginStore: HTMLElement[],
  ) => {
    targetEditor.changeViewZones((accessor) => {
      boundaries.forEach((boundary, index) => {
        const zoneNode = document.createElement("div");
        zoneNode.style.height = `${FILE_LABEL_ZONE_HEIGHT}px`;
        zoneNode.style.background = "transparent";
        zoneNode.style.position = "relative";

        const marginNode = document.createElement("div");
        marginNode.style.height = `${FILE_LABEL_ZONE_HEIGHT}px`;
        marginNode.style.background = "transparent";
        marginNode.style.position = "relative";
        marginNode.style.overflow = "visible";

        const zoneId = accessor.addZone({
          afterLineNumber: Math.max(boundary.startLineNumber - 1, 0),
          domNode: zoneNode,
          marginDomNode: marginNode,
          heightInPx: FILE_LABEL_ZONE_HEIGHT,
        });

        store.push(zoneId);
        marginStore[index] = marginNode;
      });
    });
  };

  const createWidget = (
    targetEditor: editor.ICodeEditor,
    marginNodes: HTMLElement[],
    boundary: CombinedFileBoundary,
    boundaryIndex: number,
    side: "original" | "modified",
  ) => {
    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";
    wrapper.style.height = `${FILE_LABEL_ZONE_HEIGHT}px`;
    wrapper.style.overflow = "visible";
    wrapper.style.pointerEvents = "none";

    const labelNode = document.createElement("div");
    buildLabel(labelNode, side);
    labelNode.textContent = boundary.filePath;
    wrapper.append(labelNode);

    const marginNode = marginNodes[boundaryIndex] ?? null;
    const marginLabel = marginNode ? document.createElement("div") : null;
    if (marginNode && marginLabel) {
      marginNode.textContent = "";
      buildLabel(marginLabel, side);
      marginLabel.textContent = boundary.filePath;
      marginLabel.style.borderRight = "none";
      marginLabel.style.borderRadius = "8px 0 0 8px";
      marginLabel.style.padding = side === "original" ? "0 16px 0 20px" : "0 16px 0 20px";
      marginNode.append(marginLabel);
    }

    const updateDimensions = () => {
      const layout = targetEditor.getLayoutInfo();
      wrapper.style.width = `${layout.contentWidth}px`;
      labelNode.style.width = `${layout.contentWidth}px`;
      labelNode.style.borderLeft = "none";
      labelNode.style.borderRadius = "0 8px 8px 0";
      if (marginLabel) {
        marginLabel.style.width = `${layout.contentLeft}px`;
      }
    };

    const updateSticky = () => {
      const scrollTop = targetEditor.getScrollTop();
      const boundaryTop = targetEditor.getTopForLineNumber(boundary.startLineNumber);
      const nextBoundary = boundaries[boundaryIndex + 1];
      const nextTop = nextBoundary
        ? targetEditor.getTopForLineNumber(nextBoundary.startLineNumber)
        : Number.POSITIVE_INFINITY;
      const relativeTop = boundaryTop - scrollTop;
      let translate = Math.max(-relativeTop, 0);
      const distanceToNext = nextTop - scrollTop - FILE_LABEL_ZONE_HEIGHT;
      if (Number.isFinite(distanceToNext)) {
        translate = Math.min(translate, Math.max(distanceToNext, 0));
      }
      labelNode.style.transform = `translateY(${translate}px)`;
      if (marginLabel) {
        marginLabel.style.transform = `translateY(${translate}px)`;
      }
    };

    updateDimensions();
    updateSticky();

    const disposables = [
      targetEditor.onDidLayoutChange(() => {
        updateDimensions();
        updateSticky();
      }),
      targetEditor.onDidContentSizeChange(() => {
        updateDimensions();
        updateSticky();
      }),
      targetEditor.onDidScrollChange(() => {
        updateSticky();
      }),
    ];

    const contentWidget: editor.IContentWidget = {
      getId: () => `file-label-${side}-${boundaryIndex}`,
      getDomNode: () => wrapper,
      getPosition: () => ({
        position: {
          lineNumber: Math.max(boundary.startLineNumber, 1),
          column: 1,
        },
        preference: [monacoInstance.editor.ContentWidgetPositionPreference.EXACT],
      }),
    };

    targetEditor.addContentWidget(contentWidget);
    widgets.push({
      editor: targetEditor,
      widget: contentWidget,
      dispose: () => {
        disposables.forEach((disposable) => disposable.dispose());
        if (marginLabel) {
          marginLabel.remove();
        }
      },
    });
  };

  addZones(originalEditor, originalZoneIds, originalMarginNodes);
  addZones(modifiedEditor, modifiedZoneIds, modifiedMarginNodes);

  boundaries.forEach((boundary, boundaryIndex) => {
    createWidget(originalEditor, originalMarginNodes, boundary, boundaryIndex, "original");
    createWidget(modifiedEditor, modifiedMarginNodes, boundary, boundaryIndex, "modified");
  });

  return () => {
    originalEditor.changeViewZones((accessor) => {
      originalZoneIds.forEach((zoneId) => accessor.removeZone(zoneId));
    });

    modifiedEditor.changeViewZones((accessor) => {
      modifiedZoneIds.forEach((zoneId) => accessor.removeZone(zoneId));
    });

    widgets.forEach(({ editor: targetEditor, widget, dispose }) => {
      targetEditor.removeContentWidget(widget);
      dispose();
    });
  };
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
