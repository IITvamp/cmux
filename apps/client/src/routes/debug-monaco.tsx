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

const diffSamples: DiffSample[] = [
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
      - build
  verify:
    steps:
      - lint
      - test
`,
    modified: `workflows:
  deploy:
    steps:
      - checkout
      - build
      - docker-publish
  verify:
    steps:
      - lint
      - test
      - smoke
`,
  },
  {
    id: "changelog",
    filePath: "apps/client/src/content/changelog.md",
    language: "markdown",
    original: `## v0.13.0

- add multi-agent support
- improve telemetry

## v0.12.0

- bug fixes
`,
    modified: `## v0.13.0

- add multi-agent support
- improve telemetry
- new diff viewer sandbox

## v0.12.0

- bug fixes
- document retry semantics
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

export const Route = createFileRoute("/debug-monaco")({
  component: DebugMonacoPage,
});

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

  const editorTheme = theme === "dark" ? "vs-dark" : "vs";

  const diffOptions = useMemo<editor.IDiffEditorConstructionOptions>(
    () => ({
      renderSideBySide: true,
      enableSplitViewResizing: true,
      automaticLayout: false,
      readOnly: true,
      originalEditable: false,
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
    }),
    [],
  );

  const onEditorMount: DiffOnMount = useCallback((diffEditor, monacoInstance) => {
    const originalEditor = diffEditor.getOriginalEditor();
    const modifiedEditor = diffEditor.getModifiedEditor();
    const container = diffEditor.getContainerDomNode() as HTMLElement | null;

    if (!container) {
      return;
    }

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

    const applyLayout = () => {
      const height = Math.max(computeHeight(originalEditor), computeHeight(modifiedEditor));

      const modifiedInfo = modifiedEditor.getLayoutInfo();
      const originalInfo = originalEditor.getLayoutInfo();
      const containerWidth =
        container.clientWidth ||
        container.getBoundingClientRect().width ||
        modifiedInfo.width ||
        originalInfo.width;

      if (containerWidth > 0 && height > 0) {
        diffEditor.layout({ width: containerWidth, height });
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

    const onOriginalContentChange = originalEditor.onDidChangeModelContent(() => {
      applyLayout();
    });

    const onModifiedContentChange = modifiedEditor.onDidChangeModelContent(() => {
      applyLayout();
    });

    const onOriginalConfigChange = originalEditor.onDidChangeConfiguration((event) => {
      if (event.hasChanged(monacoInstance.editor.EditorOption.lineHeight)) {
        applyLayout();
      }
    });

    const onModifiedConfigChange = modifiedEditor.onDidChangeConfiguration((event) => {
      if (event.hasChanged(monacoInstance.editor.EditorOption.lineHeight)) {
        applyLayout();
      }
    });

    const onOriginalSizeChange = originalEditor.onDidContentSizeChange(() => {
      applyLayout();
    });

    const onModifiedSizeChange = modifiedEditor.onDidContentSizeChange(() => {
      applyLayout();
    });

    disposables.push(
      onOriginalContentChange,
      onModifiedContentChange,
      onOriginalConfigChange,
      onModifiedConfigChange,
      onOriginalSizeChange,
      onModifiedSizeChange,
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
  }, []);

  return (
    <div className="min-h-dvh bg-neutral-100 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="m-1 h-[calc(100dvh-8px)] overflow-auto rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="space-y-4 p-4 sm:p-6">
          {diffSamples.map((sample) => (
            <article
              key={sample.id}
              className="relative rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
            >
              <header className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50 px-4 py-2 dark:border-neutral-800 dark:bg-neutral-950/40">
                <span className="font-mono text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  {sample.filePath}
                </span>
              </header>
              <div className="flex-1 overflow-hidden rounded-b-lg">
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
                  <div className="flex items-center justify-center p-8 text-sm text-neutral-500 dark:text-neutral-400">
                    Loading Monaco diff editor…
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
