import { createFileRoute } from "@tanstack/react-router";
import { DiffEditor, type DiffOnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useTheme } from "@/components/theme/use-theme";
import { debugMonacoDiffSamples } from "@/lib/debug-monaco-samples";
import type { DiffSample } from "@/lib/debug-monaco-samples";
import { loaderInitPromise } from "@/lib/monaco-environment";

// Reserve space for Monaco before it initializes so layout does not jump.
const DEFAULT_MONACO_LINE_HEIGHT = 20;
const MONACO_VERTICAL_PADDING = 0;
const CARD_HEADER_MAX_HEIGHT = 30;
const MIN_EDITOR_LINE_FALLBACK = 4;
const HIDDEN_REGION_BASE_PLACEHOLDER_HEIGHT = 20;
const HIDDEN_REGION_PER_LINE_HEIGHT = 0.6;

const HIDE_UNCHANGED_REGIONS_SETTINGS = {
  revealLineCount: 2,
  minimumLineCount: 6,
  contextLineCount: 3,
} as const;

type DiffSampleWithLayout = DiffSample & {
  editorMinHeight: number;
  articleMinHeight: number;
  visibleLineCount: number;
  limitedVisibleLineCount: number;
  collapsedRegionCount: number;
  hiddenLineCount: number;
};

const newlinePattern = /\r?\n/;

type HideUnchangedRegionsConfig = typeof HIDE_UNCHANGED_REGIONS_SETTINGS;

type DiffBlock =
  | {
      kind: "changed";
      originalLength: number;
      modifiedLength: number;
    }
  | {
      kind: "unchanged";
      originalLength: number;
      modifiedLength: number;
    };

type CollapsedLayoutEstimate = {
  visibleLineCount: number;
  collapsedRegionCount: number;
  hiddenLineCount: number;
};

type EditorLayoutMetrics = {
  visibleLineCount: number;
  limitedVisibleLineCount: number;
  collapsedRegionCount: number;
  editorMinHeight: number;
  hiddenLineCount: number;
};

type DiffSegmentType = "equal" | "insert" | "delete";

type DiffSegment = {
  type: DiffSegmentType;
  originalStart: number;
  originalEnd: number;
  modifiedStart: number;
  modifiedEnd: number;
};

function splitContentIntoLines(content: string): string[] {
  if (!content) {
    return [""];
  }

  const parts = content.split(newlinePattern);
  return parts.length > 0 ? parts : [""];
}

function computeDiffBlocks(
  originalLines: readonly string[],
  modifiedLines: readonly string[],
): DiffBlock[] {
  const originalLength = originalLines.length;
  const modifiedLength = modifiedLines.length;

  if (originalLength === 0 && modifiedLength === 0) {
    return [];
  }

  const dp: Uint32Array[] = Array.from(
    { length: originalLength + 1 },
    () => new Uint32Array(modifiedLength + 1),
  );

  for (let originalIndex = originalLength - 1; originalIndex >= 0; originalIndex -= 1) {
    const currentRow = dp[originalIndex];
    const nextRow = dp[originalIndex + 1];

    for (
      let modifiedIndex = modifiedLength - 1;
      modifiedIndex >= 0;
      modifiedIndex -= 1
    ) {
      if (originalLines[originalIndex] === modifiedLines[modifiedIndex]) {
        currentRow[modifiedIndex] = nextRow[modifiedIndex + 1] + 1;
      } else {
        currentRow[modifiedIndex] = Math.max(
          nextRow[modifiedIndex],
          currentRow[modifiedIndex + 1],
        );
      }
    }
  }

  const segments: DiffSegment[] = [];
  let currentSegment: DiffSegment | null = null;

  const pushSegment = () => {
    if (currentSegment) {
      segments.push(currentSegment);
      currentSegment = null;
    }
  };

  let originalIndex = 0;
  let modifiedIndex = 0;

  while (originalIndex < originalLength || modifiedIndex < modifiedLength) {
    const originalExhausted = originalIndex >= originalLength;
    const modifiedExhausted = modifiedIndex >= modifiedLength;

    if (
      !originalExhausted &&
      !modifiedExhausted &&
      originalLines[originalIndex] === modifiedLines[modifiedIndex]
    ) {
      if (!currentSegment || currentSegment.type !== "equal") {
        pushSegment();
        currentSegment = {
          type: "equal",
          originalStart: originalIndex,
          originalEnd: originalIndex,
          modifiedStart: modifiedIndex,
          modifiedEnd: modifiedIndex,
        };
      }

      originalIndex += 1;
      modifiedIndex += 1;
      currentSegment.originalEnd = originalIndex;
      currentSegment.modifiedEnd = modifiedIndex;
      continue;
    }

    if (
      modifiedExhausted ||
      (!originalExhausted &&
        dp[originalIndex + 1][modifiedIndex] >= dp[originalIndex][modifiedIndex + 1])
    ) {
      if (!currentSegment || currentSegment.type !== "delete") {
        pushSegment();
        currentSegment = {
          type: "delete",
          originalStart: originalIndex,
          originalEnd: originalIndex,
          modifiedStart: modifiedIndex,
          modifiedEnd: modifiedIndex,
        };
      }

      originalIndex += 1;
      currentSegment.originalEnd = originalIndex;
    } else {
      if (!currentSegment || currentSegment.type !== "insert") {
        pushSegment();
        currentSegment = {
          type: "insert",
          originalStart: originalIndex,
          originalEnd: originalIndex,
          modifiedStart: modifiedIndex,
          modifiedEnd: modifiedIndex,
        };
      }

      modifiedIndex += 1;
      currentSegment.modifiedEnd = modifiedIndex;
    }
  }

  pushSegment();

  const blocks: DiffBlock[] = [];
  let pendingChange: Extract<DiffBlock, { kind: "changed" }> | null = null;

  for (const segment of segments) {
    const originalSpan = segment.originalEnd - segment.originalStart;
    const modifiedSpan = segment.modifiedEnd - segment.modifiedStart;

    if (segment.type === "equal") {
      if (pendingChange) {
        blocks.push(pendingChange);
        pendingChange = null;
      }

      if (originalSpan > 0 || modifiedSpan > 0) {
        blocks.push({
          kind: "unchanged",
          originalLength: originalSpan,
          modifiedLength: modifiedSpan,
        });
      }

      continue;
    }

    if (!pendingChange) {
      pendingChange = {
        kind: "changed",
        originalLength: 0,
        modifiedLength: 0,
      };
    }

    pendingChange.originalLength += originalSpan;
    pendingChange.modifiedLength += modifiedSpan;
  }

  if (pendingChange) {
    blocks.push(pendingChange);
  }

  return blocks;
}

function estimateCollapsedLayout(
  original: string,
  modified: string,
  config: HideUnchangedRegionsConfig,
): CollapsedLayoutEstimate {
  const originalLines = splitContentIntoLines(original);
  const modifiedLines = splitContentIntoLines(modified);
  const blocks = computeDiffBlocks(originalLines, modifiedLines);

  if (blocks.length === 0) {
    return {
      visibleLineCount: Math.max(config.minimumLineCount, MIN_EDITOR_LINE_FALLBACK),
      collapsedRegionCount: 0,
      hiddenLineCount: 0,
    };
  }

  const hasChange = blocks.some(
    (block) =>
      block.kind === "changed" &&
      (block.originalLength > 0 || block.modifiedLength > 0),
  );

  if (!hasChange) {
    const totalLines = Math.max(originalLines.length, modifiedLines.length);
    const visibleLineCount = Math.min(
      totalLines,
      Math.max(config.minimumLineCount, MIN_EDITOR_LINE_FALLBACK),
    );

    return {
      visibleLineCount,
      collapsedRegionCount: 0,
      hiddenLineCount: 0,
    };
  }

  let visibleLineCount = 0;
  let collapsedRegionCount = 0;
  let hiddenLineCount = 0;

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];

    if (block.kind === "changed") {
      visibleLineCount += Math.max(block.originalLength, block.modifiedLength);
      continue;
    }

    const blockLength = Math.max(block.originalLength, block.modifiedLength);

    if (blockLength === 0) {
      continue;
    }

    const hasPreviousChange = index > 0 && blocks[index - 1]?.kind === "changed";
    const hasNextChange =
      index < blocks.length - 1 && blocks[index + 1]?.kind === "changed";

    let visibleBudget = 0;

    if (hasPreviousChange) {
      visibleBudget += config.contextLineCount;
    }

    if (hasNextChange) {
      visibleBudget += config.contextLineCount;
    }

    if (!hasPreviousChange && !hasNextChange) {
      visibleBudget = Math.max(
        config.minimumLineCount,
        MIN_EDITOR_LINE_FALLBACK,
      );
    } else {
      visibleBudget = Math.max(visibleBudget, config.minimumLineCount);
    }

    const displayedLines = Math.min(blockLength, visibleBudget);
    visibleLineCount += displayedLines;

    if (displayedLines < blockLength) {
      collapsedRegionCount += 1;
      hiddenLineCount += blockLength - displayedLines;
    }
  }

  visibleLineCount = Math.max(visibleLineCount, MIN_EDITOR_LINE_FALLBACK);

  return { visibleLineCount, collapsedRegionCount, hiddenLineCount };
}

function computeEditorLayoutMetrics(sample: DiffSample): EditorLayoutMetrics {
  const {
    visibleLineCount,
    collapsedRegionCount,
    hiddenLineCount,
  } = estimateCollapsedLayout(
    sample.original,
    sample.modified,
    HIDE_UNCHANGED_REGIONS_SETTINGS,
  );

  const limitedVisibleLineCount = Math.min(
    Math.max(visibleLineCount, MIN_EDITOR_LINE_FALLBACK),
    120,
  );

  const lineHeightPortion =
    limitedVisibleLineCount * DEFAULT_MONACO_LINE_HEIGHT + MONACO_VERTICAL_PADDING;

  const placeholderPortion =
    collapsedRegionCount * HIDDEN_REGION_BASE_PLACEHOLDER_HEIGHT +
    hiddenLineCount * HIDDEN_REGION_PER_LINE_HEIGHT;

  return {
    visibleLineCount,
    limitedVisibleLineCount,
    collapsedRegionCount,
    editorMinHeight: lineHeightPortion + placeholderPortion,
    hiddenLineCount,
  };
}

function withLayout(sample: DiffSample): DiffSampleWithLayout {
  const {
    editorMinHeight,
    visibleLineCount,
    limitedVisibleLineCount,
    collapsedRegionCount,
    hiddenLineCount,
  } = computeEditorLayoutMetrics(sample);

  return {
    ...sample,
    editorMinHeight,
    articleMinHeight: editorMinHeight + CARD_HEADER_MAX_HEIGHT,
    visibleLineCount,
    limitedVisibleLineCount,
    collapsedRegionCount,
    hiddenLineCount,
  };
}

const diffSamplesWithLayout = debugMonacoDiffSamples.map(withLayout);

export const Route = createFileRoute("/debug-monaco")({
  component: DebugMonacoPage,
});

type DiffSampleCardProps = {
  sample: DiffSampleWithLayout;
  diffOptions: editor.IDiffEditorConstructionOptions;
  editorTheme: string;
  isEditorReady: boolean;
  onEditorMount: DiffOnMount;
};

function DiffSampleCard({
  sample,
  diffOptions,
  editorTheme,
  isEditorReady,
  onEditorMount,
}: DiffSampleCardProps) {
  return (
    <article
      className="relative rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
      style={{ minHeight: sample.articleMinHeight }}
    >
      <header
        className="sticky top-0 z-10 flex items-center border-b border-neutral-200 bg-neutral-50 px-4 dark:border-neutral-800 dark:bg-neutral-950/40"
        style={{
          height: CARD_HEADER_MAX_HEIGHT,
          minHeight: CARD_HEADER_MAX_HEIGHT,
          maxHeight: CARD_HEADER_MAX_HEIGHT,
        }}
      >
        <span className="font-mono text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {sample.filePath}
        </span>
      </header>
      <div
        className="flex-1 overflow-hidden rounded-b-lg"
        style={{ minHeight: sample.editorMinHeight }}
      >
        {isEditorReady ? (
          <DiffEditor
            language={sample.language}
            original={sample.original}
            modified={sample.modified}
            theme={editorTheme}
            options={diffOptions}
            onMount={onEditorMount}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-sm text-neutral-500 dark:text-neutral-400">
            Loading Monaco diff editor…
          </div>
        )}
      </div>
    </article>
  );
}

function DebugMonacoPage() {
  const { theme } = useTheme();

  const [isEditorReady, setEditorReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loaderInitPromise
      .then(() => {
        if (!cancelled) {
          setEditorReady(true);
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

  const editorTheme = theme === "dark" ? "cmux-dark" : "cmux-light";

  const diffOptions = useMemo<editor.IDiffEditorConstructionOptions>(
    () => ({
      renderSideBySide: true,
      enableSplitViewResizing: true,
      automaticLayout: false,
      readOnly: true,
      originalEditable: false,
      lineHeight: DEFAULT_MONACO_LINE_HEIGHT,
      minimap: { enabled: false },
      renderOverviewRuler: false,
      wordWrap: "on",
      scrollBeyondLastLine: false,
      scrollbar: {
        vertical: "hidden",
        horizontal: "hidden",
        handleMouseWheel: false,
        alwaysConsumeMouseWheel: false,
      },
      hideUnchangedRegions: {
        enabled: true,
        ...HIDE_UNCHANGED_REGIONS_SETTINGS,
      },
    }),
    [],
  );

  const createOnEditorMount = useCallback(
    (sample: DiffSampleWithLayout): DiffOnMount =>
      (diffEditor, monacoInstance) => {
        const originalEditor = diffEditor.getOriginalEditor();
        const modifiedEditor = diffEditor.getModifiedEditor();
        const container = diffEditor.getContainerDomNode() as HTMLElement | null;

        if (!container) {
          return;
        }

        const disposables: Array<{ dispose: () => void }> = [];
        const originalVisibility = container.style.visibility;
        const originalTransform = container.style.transform;
        let isContainerVisible = container.style.visibility !== "hidden";

        const computeHeight = (targetEditor: editor.IStandaloneCodeEditor) => {
          const contentHeight = targetEditor.getContentHeight();
          if (contentHeight > 0) {
            return contentHeight;
          }

          const lineHeight = targetEditor.getOption(
            monacoInstance.editor.EditorOption.lineHeight,
          );
          const model = targetEditor.getModel();
          const lineCount = model ? Math.max(1, model.getLineCount()) : 1;

          return lineCount * lineHeight;
        };

        container.style.minHeight = `${sample.editorMinHeight}px`;

        const applyLayout = () => {
          const height = Math.max(
            computeHeight(originalEditor),
            computeHeight(modifiedEditor),
          );

          const modifiedInfo = modifiedEditor.getLayoutInfo();
          const originalInfo = originalEditor.getLayoutInfo();
          const containerWidth =
            container.clientWidth ||
            container.getBoundingClientRect().width ||
            modifiedInfo.width ||
            originalInfo.width;

          const enforcedHeight = Math.max(sample.editorMinHeight, height);

          if (containerWidth > 0 && enforcedHeight > 0) {
            diffEditor.layout({ width: containerWidth, height: enforcedHeight });
          }
        };

        const showContainer = () => {
          if (isContainerVisible) {
            return;
          }

          isContainerVisible = true;
          container.style.visibility = originalVisibility || "visible";
          container.style.transform = originalTransform || "";
        };

        const hideContainer = () => {
          if (!isContainerVisible) {
            return;
          }

          isContainerVisible = false;
          container.style.visibility = "hidden";
          container.style.transform = "translateX(100000px)";
        };

        const observer =
          typeof ResizeObserver === "undefined"
            ? null
            : new ResizeObserver(() => {
                applyLayout();
              });

        if (observer) {
          observer.observe(container);
          disposables.push({ dispose: () => observer.disconnect() });
        }

        const intersectionTarget = container.closest("article") ?? container;

        const intersectionObserver =
          typeof IntersectionObserver === "undefined"
            ? null
            : new IntersectionObserver(
                (entries) => {
                  for (const entry of entries) {
                    if (entry.target !== intersectionTarget) {
                      continue;
                    }

                    if (entry.isIntersecting) {
                      showContainer();
                      applyLayout();
                    } else {
                      hideContainer();
                    }
                  }
                },
                {
                  threshold: 0.1,
                },
              );

        if (intersectionObserver) {
          intersectionObserver.observe(intersectionTarget);
          disposables.push({
            dispose: () => intersectionObserver.unobserve(intersectionTarget),
          });
          disposables.push({ dispose: () => intersectionObserver.disconnect() });
        }

        showContainer();
        disposables.push({
          dispose: () => {
            isContainerVisible = true;
            container.style.visibility = originalVisibility || "visible";
            container.style.transform = originalTransform || "";
          },
        });

        const onOriginalContentChange = originalEditor.onDidChangeModelContent(
          () => {
            applyLayout();
          },
        );

        const onModifiedContentChange = modifiedEditor.onDidChangeModelContent(
          () => {
            applyLayout();
          },
        );

        const onOriginalConfigChange = originalEditor.onDidChangeConfiguration(
          (event) => {
            if (event.hasChanged(monacoInstance.editor.EditorOption.lineHeight)) {
              applyLayout();
            }
          },
        );

        const onModifiedConfigChange = modifiedEditor.onDidChangeConfiguration(
          (event) => {
            if (event.hasChanged(monacoInstance.editor.EditorOption.lineHeight)) {
              applyLayout();
            }
          },
        );

        const onOriginalSizeChange = originalEditor.onDidContentSizeChange(() => {
          applyLayout();
        });

        const onModifiedSizeChange = modifiedEditor.onDidContentSizeChange(() => {
          applyLayout();
        });

        const onOriginalHiddenAreasChange = originalEditor.onDidChangeHiddenAreas(
          () => {
            applyLayout();
          },
        );

        const onModifiedHiddenAreasChange = modifiedEditor.onDidChangeHiddenAreas(
          () => {
            applyLayout();
          },
        );

        const onDidUpdateDiff = diffEditor.onDidUpdateDiff(() => {
          applyLayout();
        });

        disposables.push(
          onOriginalContentChange,
          onModifiedContentChange,
          onOriginalConfigChange,
          onModifiedConfigChange,
          onOriginalSizeChange,
          onModifiedSizeChange,
          onOriginalHiddenAreasChange,
          onModifiedHiddenAreasChange,
          onDidUpdateDiff,
        );

        const disposeListener = diffEditor.onDidDispose(() => {
          disposables.forEach((disposable) => {
            try {
              disposable.dispose();
            } catch (error) {
              console.error("Failed to dispose Monaco listener", error);
            }
          });
        });

        disposables.push(disposeListener);

        applyLayout();
      },
    [],
  );

  return (
    <div className="min-h-dvh bg-neutral-100 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="m-1 h-[calc(100dvh-8px)] overflow-auto rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="space-y-4 p-4 sm:p-6">
          {diffSamplesWithLayout.map((sample) => (
            <DiffSampleCard
              key={sample.id}
              sample={sample}
              diffOptions={diffOptions}
              editorTheme={editorTheme}
              isEditorReady={isEditorReady}
              onEditorMount={createOnEditorMount(sample)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
