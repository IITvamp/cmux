import { createFileRoute } from "@tanstack/react-router";
import { DiffEditor, type DiffOnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useTheme } from "@/components/theme/use-theme";
import { loaderInitPromise } from "@/lib/monaco-environment";

type MonacoLanguage =
  | "typescript"
  | "javascript"
  | "json"
  | "markdown"
  | "yaml"
  | "plaintext";

type DiffSample = {
  id: string;
  filePath: string;
  language: MonacoLanguage;
  original: string;
  modified: string;
};

// Reserve space for Monaco before it initializes so layout does not jump.
const DEFAULT_MONACO_LINE_HEIGHT = 20;
const MONACO_VERTICAL_PADDING = 0;
const CARD_HEADER_MIN_HEIGHT = 40;
const MIN_EDITOR_LINE_FALLBACK = 4;
const HIDDEN_REGION_PLACEHOLDER_HEIGHT = 24;

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
};

type EditorLayoutMetrics = {
  visibleLineCount: number;
  limitedVisibleLineCount: number;
  collapsedRegionCount: number;
  editorMinHeight: number;
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
    };
  }

  let visibleLineCount = 0;
  let collapsedRegionCount = 0;

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
    const perSideAllowance = config.contextLineCount + config.revealLineCount;

    if (hasPreviousChange) {
      visibleBudget += perSideAllowance;
    }

    if (hasNextChange) {
      visibleBudget += perSideAllowance;
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
    }
  }

  visibleLineCount = Math.max(visibleLineCount, MIN_EDITOR_LINE_FALLBACK);

  return { visibleLineCount, collapsedRegionCount };
}

function computeEditorLayoutMetrics(sample: DiffSample): EditorLayoutMetrics {
  const { visibleLineCount, collapsedRegionCount } = estimateCollapsedLayout(
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
    collapsedRegionCount * HIDDEN_REGION_PLACEHOLDER_HEIGHT;

  return {
    visibleLineCount,
    limitedVisibleLineCount,
    collapsedRegionCount,
    editorMinHeight: lineHeightPortion + placeholderPortion,
  };
}

function withLayout(sample: DiffSample): DiffSampleWithLayout {
  const {
    editorMinHeight,
    visibleLineCount,
    limitedVisibleLineCount,
    collapsedRegionCount,
  } = computeEditorLayoutMetrics(sample);

  return {
    ...sample,
    editorMinHeight,
    articleMinHeight: editorMinHeight + CARD_HEADER_MIN_HEIGHT,
    visibleLineCount,
    limitedVisibleLineCount,
    collapsedRegionCount,
  };
}

const EXECUTION_PLAN_STAGE_COUNT = 140;

const executionPlanUpdates = new Map<
  number,
  { status: string; durationMs: number; retries: number }
>([
  [0, { status: "queued", durationMs: 45, retries: 1 }],
  [18, { status: "running", durationMs: 240, retries: 0 }],
  [47, { status: "running", durationMs: 420, retries: 2 }],
  [73, { status: "blocked", durationMs: 0, retries: 3 }],
  [96, { status: "queued", durationMs: 195, retries: 1 }],
  [119, { status: "completed", durationMs: 940, retries: 1 }],
  [139, { status: "completed", durationMs: 1230, retries: 2 }],
]);

const executionPlanInsertions = new Map<number, string[]>([
  [
    59,
    [
      '  { id: "stage-060-review", status: "blocked", durationMs: 0, retries: 2 },',
      '  { id: "stage-060-retry", status: "queued", durationMs: 42, retries: 3 },',
    ],
  ],
  [
    104,
    [
      '  { id: "stage-105-diagnostics", status: "running", durationMs: 720, retries: 1 },',
    ],
  ],
]);

function createLongExecutionPlanSample(): DiffSample {
  const padLabel = (value: number) => value.toString().padStart(3, "0");

  const originalParts: string[] = [
    "type ExecutionStage = {",
    "  id: string;",
    '  status: "pending" | "queued" | "running" | "blocked" | "completed";',
    "  durationMs?: number;",
    "};",
    "",
    "export const executionPlan: ExecutionStage[] = [",
  ];

  const modifiedParts: string[] = [
    "type ExecutionStage = {",
    "  id: string;",
    '  status: "pending" | "queued" | "running" | "blocked" | "completed";',
    "  durationMs?: number;",
    "  retries?: number;",
    "};",
    "",
    "export const executionPlan: ExecutionStage[] = [",
  ];

  for (let index = 0; index < EXECUTION_PLAN_STAGE_COUNT; index += 1) {
    const label = padLabel(index + 1);
    const baseDuration = ((index % 9) + 1) * 25;
    const baseLine = `  { id: "stage-${label}", status: "pending", durationMs: ${baseDuration} },`;
    originalParts.push(baseLine);

    const update = executionPlanUpdates.get(index);
    if (update) {
      modifiedParts.push(
        `  { id: "stage-${label}", status: "${update.status}", durationMs: ${update.durationMs}, retries: ${update.retries} },`,
      );
    } else {
      modifiedParts.push(baseLine);
    }

    const insertions = executionPlanInsertions.get(index);
    if (insertions) {
      modifiedParts.push(...insertions);
    }
  }

  modifiedParts.push(
    '  { id: "stage-141", status: "review", durationMs: 210, retries: 1 },',
  );

  originalParts.push("];");
  modifiedParts.push("];");

  originalParts.push(
    "",
    'export function countStages(status: ExecutionStage["status"]) {',
    "  return executionPlan.filter((stage) => stage.status === status).length;",
    "}",
    "",
    "export function describePlan() {",
    '  return executionPlan.map((stage) => stage.id).join(", ");',
    "}",
    "",
    "export function hasBlockingStage() {",
    '  return executionPlan.some((stage) => stage.status === "blocked");',
    "}",
  );

  modifiedParts.push(
    "",
    'export function countStages(status: ExecutionStage["status"]) {',
    "  return executionPlan.reduce((total, stage) =>",
    "    stage.status === status ? total + 1 : total,",
    "  0);",
    "}",
    "",
    "export function describePlan(options: { includeDurations?: boolean } = {}) {",
    "  return executionPlan",
    "    .map((stage) => {",
    "      if (!options.includeDurations) {",
    "        return stage.id;",
    "      }",
    "      const duration = stage.durationMs ?? 0;",
    "      const retries = stage.retries ?? 0;",
    "      return `${stage.id} (${duration}ms, retries=${retries})`;",
    "    })",
    "    .join(",
    ");",
    "}",
    "",
    "export function hasBlockingStage() {",
    "  return executionPlan.some((stage) => {",
    '    if (stage.status === "blocked") {',
    "      return true;",
    "    }",
    "    return (stage.retries ?? 0) > 2;",
    "  });",
    "}",
    "",
    "export function getRetrySummary() {",
    "  return executionPlan",
    "    .filter((stage) => (stage.retries ?? 0) > 0)",
    "    .map((stage) => `${stage.id}:${stage.retries ?? 0}`)",
    "    .join(",
    ");",
    "}",
  );

  return {
    id: "execution-plan",
    filePath: "apps/server/src/plan/execution-plan.ts",
    language: "typescript",
    original: originalParts.join("\n"),
    modified: modifiedParts.join("\n"),
  };
}

const longExecutionPlanSample = createLongExecutionPlanSample();

const diffSamples: DiffSample[] = [
  longExecutionPlanSample,
  {
    id: "agents-selector",
    filePath: "packages/agents/src/selector.ts",
    language: "typescript",
    original: `export function rankAgents(agents: Array<{ latency: number }>) {
  return [...agents].sort((a, b) => a.latency - b.latency);
}

export function shouldWakeAgent(lastActiveAt: number, thresholdMs: number) {
  return Date.now() - lastActiveAt > thresholdMs;
}
`,
    modified: `export function rankAgents(agents: Array<{ latency: number; priority?: number }>) {
  return [...agents]
    .map((agent) => ({
      ...agent,
      score: (agent.priority ?? 0) * 1000 - agent.latency,
    }))
    .sort((a, b) => b.score - a.score);
}

export function shouldWakeAgent(lastActiveAt: number, thresholdMs: number) {
  const elapsed = Date.now() - lastActiveAt;
  return elapsed >= thresholdMs && thresholdMs > 0;
}
`,
  },
  {
    id: "feature-flags",
    filePath: "apps/server/src/config/feature-flags.ts",
    language: "typescript",
    original: `export type FeatureFlag = {
  name: string;
  enabled: boolean;
};

export const defaultFlags: FeatureFlag[] = [
  { name: "monaco-batch", enabled: false },
  { name: "agent-recording", enabled: false },
];
export function isEnabled(flags: FeatureFlag[], name: string) {
  return flags.some((flag) => flag.name === name && flag.enabled);
}
`,
    modified: `export type FeatureFlag = {
  name: string;
  enabled: boolean;
};

export const defaultFlags: FeatureFlag[] = [
  { name: "monaco-batch", enabled: true },
  { name: "agent-recording", enabled: false },
  { name: "structured-logs", enabled: true },
];

export function isEnabled(flags: FeatureFlag[], name: string) {
  const found = flags.find((flag) => flag.name === name);
  return found?.enabled ?? false;
}
`,
  },
  {
    id: "format-duration",
    filePath: "apps/client/src/utils/format-duration.ts",
    language: "typescript",
    original: `export function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return seconds + "s";
}

export function formatLatency(latency: number) {
  return latency.toFixed(0) + "ms";
}
`,
    modified: `export function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0
    ? minutes + "m " + remainingSeconds + "s"
    : seconds + "s";
}

export function formatLatency(latency: number) {
  return latency < 1
    ? (latency * 1000).toFixed(0) + "us"
    : latency.toFixed(2) + "ms";
}
`,
  },
  {
    id: "task-progress",
    filePath: "apps/client/src/hooks/use-task-progress.ts",
    language: "typescript",
    original: `export function getTaskProgress(task: { completeSteps: number; totalSteps: number }) {
  if (task.totalSteps === 0) {
    return 0;
  }

  return Math.round((task.completeSteps / task.totalSteps) * 100);
}

export function isTaskStale(updatedAt: number, now: number) {
  return now - updatedAt > 30_000;
}
`,
    modified: `export function getTaskProgress(task: { completeSteps: number; totalSteps: number }) {
  if (task.totalSteps === 0) {
    return 0;
  }

  const value = (task.completeSteps / task.totalSteps) * 100;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function isTaskStale(updatedAt: number, now: number) {
  const elapsed = now - updatedAt;
  return elapsed > 30_000 && elapsed > 0;
}
`,
  },
  {
    id: "session-handler",
    filePath: "apps/server/src/routes/session-handler.ts",
    language: "typescript",
    original: `export async function loadSession(id: string) {
  const response = await fetch("/api/sessions/" + id);
  if (!response.ok) {
    throw new Error("Failed to load session");
  }

  return response.json();
}

export async function archiveSession(id: string) {
  const response = await fetch("/api/sessions/" + id + "/archive", { method: "POST" });
  if (!response.ok) {
    throw new Error("Failed to archive session");
  }
}
`,
    modified: `export async function loadSession(id: string) {
  const response = await fetch("/api/sessions/" + id);
  if (!response.ok) {
    throw new Error("Failed to load session");
  }

  const payload = await response.json();
  return {
    ...payload,
    loadedAt: Date.now(),
  };
}

export async function archiveSession(id: string) {
  const response = await fetch("/api/sessions/" + id + "/archive", { method: "POST" });
  if (!response.ok) {
    throw new Error("Failed to archive session");
  }

  return { archiveRequestedAt: Date.now() };
}
`,
  },
  {
    id: "shared-logger",
    filePath: "packages/shared/src/logger.ts",
    language: "typescript",
    original: `export function logInfo(message: string) {
  console.info(message);
}

export function logError(message: string, error?: unknown) {
  console.error(message, error);
}
`,
    modified: `export function logInfo(message: string, context: Record<string, unknown> = {}) {
  console.info("[info] " + message, context);
}

export function logError(message: string, error?: unknown) {
  console.error("[error] " + message, error);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
}
`,
  },
  {
    id: "run-timers",
    filePath: "apps/client/src/store/run-timers.ts",
    language: "typescript",
    original: `export function startTimer(label: string) {
  performance.mark(label + "-start");
}

export function endTimer(label: string) {
  performance.mark(label + "-end");
  performance.measure(label, label + "-start", label + "-end");
}
`,
    modified: `export function startTimer(label: string) {
  performance.mark(label + "-start");
  console.time(label);
}

export function endTimer(label: string) {
  performance.mark(label + "-end");
  performance.measure(label, label + "-start", label + "-end");
  console.timeEnd(label);
}
`,
  },
  {
    id: "workflows-yaml",
    filePath: "apps/server/src/config/workflows.yaml",
    language: "yaml",
    original: `workflows:
  deploy:
    steps:
      - checkout
      - install
      - build
      - smoke
  verify:
    steps:
      - lint
      - typecheck
      - test
      - coverage
  nightly:
    steps:
      - migrate
      - seed
      - e2e
      - report
`,
    modified: `workflows:
  deploy:
    steps:
      - checkout
      - install
      - build
      - package
      - smoke
  verify:
    steps:
      - lint
      - typecheck
      - test
      - coverage
      - mutation
  nightly:
    steps:
      - migrate
      - seed
      - e2e
      - report
      - snapshot
  cleanup:
    steps:
      - prune
      - rotate-logs
`,
  },
  {
    id: "changelog",
    filePath: "apps/client/src/content/changelog.md",
    language: "markdown",
    original: `## v0.13.0

- add multi-agent support
- improve telemetry

## v0.12.5

- add new worker pool
- fix diff layout

## v0.12.0

- bug fixes
- reduce bundle size

## v0.11.0

- initial release
- support debug routes
`,
    modified: `## v0.13.0

- add multi-agent support
- improve telemetry
- new diff viewer sandbox

## v0.12.5

- add new worker pool
- fix diff layout
- experimental timeline

## v0.12.0

- bug fixes
- reduce bundle size
- document retry semantics

## v0.11.0

- initial release
- support debug routes
- added debug tools
`,
  },
  {
    id: "runtime-schema",
    filePath: "packages/runtime/src/schema.json",
    language: "json",
    original: `{
  "version": 1,
  "fields": [
    { "name": "id", "type": "string" },
    { "name": "status", "type": "string" }
  ],
  "indexes": []
}
`,
    modified: `{
  "version": 1,
  "fields": [
    { "name": "id", "type": "string" },
    { "name": "status", "type": "string" },
    { "name": "createdAt", "type": "number" }
  ],
  "indexes": [
    { "name": "by_status", "fields": ["status"] }
  ]
}
`,
  },
];

const diffSamplesWithLayout = diffSamples.map(withLayout);

const diffSampleLayoutEstimates = diffSamplesWithLayout.reduce<
  Record<
    string,
    {
      visibleLineCount: number;
      limitedVisibleLineCount: number;
      collapsedRegionCount: number;
      estimatedEditorMinHeight: number;
      estimatedArticleMinHeight: number;
    }
  >
>((accumulator, sample) => {
  accumulator[sample.filePath] = {
    visibleLineCount: sample.visibleLineCount,
    limitedVisibleLineCount: sample.limitedVisibleLineCount,
    collapsedRegionCount: sample.collapsedRegionCount,
    estimatedEditorMinHeight: sample.editorMinHeight,
    estimatedArticleMinHeight: sample.articleMinHeight,
  };

  return accumulator;
}, {});

console.log("Diff sample layout estimates", diffSampleLayoutEstimates);

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
  const articleMinHeight = isEditorReady ? undefined : sample.articleMinHeight;
  const editorMinHeight = isEditorReady ? undefined : sample.editorMinHeight;

  return (
    <article
      className="relative rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
      style={{ minHeight: articleMinHeight }}
    >
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50 px-4 py-2 dark:border-neutral-800 dark:bg-neutral-950/40">
        <span className="font-mono text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {sample.filePath}
        </span>
      </header>
      <div
        className="flex-1 overflow-hidden rounded-b-lg"
        style={{ minHeight: editorMinHeight }}
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

        console.log(`Diff sample ${sample.filePath} estimated heights`, {
          estimatedEditorMinHeight: sample.editorMinHeight,
          estimatedArticleMinHeight: sample.articleMinHeight,
        });

        const disposables: Array<{ dispose: () => void }> = [];

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

        const logGroundTruthHeights = () => {
          const containerRect = container.getBoundingClientRect();
          const originalContentHeight = originalEditor.getContentHeight();
          const modifiedContentHeight = modifiedEditor.getContentHeight();

          console.log(`Diff sample ${sample.filePath} ground truth heights`, {
            containerHeight: containerRect.height,
            originalContentHeight,
            modifiedContentHeight,
          });
        };

        let groundTruthTimeoutId: ReturnType<typeof setTimeout> | null = null;

        const scheduleGroundTruthLog = () => {
          if (groundTruthTimeoutId !== null) {
            clearTimeout(groundTruthTimeoutId);
          }

          groundTruthTimeoutId = setTimeout(() => {
            groundTruthTimeoutId = null;
            logGroundTruthHeights();
          }, 2000);
        };

        disposables.push({
          dispose: () => {
            if (groundTruthTimeoutId !== null) {
              clearTimeout(groundTruthTimeoutId);
              groundTruthTimeoutId = null;
            }
          },
        });

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

          if (containerWidth > 0 && height > 0) {
            diffEditor.layout({ width: containerWidth, height });
            scheduleGroundTruthLog();
          }
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
