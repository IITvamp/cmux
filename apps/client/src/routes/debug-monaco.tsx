import { createFileRoute } from "@tanstack/react-router";
import { DiffEditor } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useEffect, useMemo, useState } from "react";

import { useTheme } from "@/components/theme/use-theme";
import { loaderInitPromise } from "@/lib/monaco-environment";

const defaultOriginal = `function computeAgentCount(agents: string[]) {
  if (agents.length === 0) {
    return 0;
  }

  return agents.filter((agent) => agent.trim().length > 0).length;
}`;

const defaultModified = `export function computeAgentCount(agents: string[]) {
  if (agents.length === 0) {
    return 0;
  }

  const activeAgents = agents.filter((agent) => agent.trim().length > 0);
  return activeAgents.length;
}`;

const languages = [
  "typescript",
  "javascript",
  "json",
  "markdown",
  "yaml",
  "plaintext",
] as const;

type MonacoLanguage = (typeof languages)[number];

const isMonacoLanguage = (value: string): value is MonacoLanguage =>
  languages.some((languageOption) => languageOption === value);

export const Route = createFileRoute("/debug-monaco")({
  component: DebugMonacoPage,
});

function DebugMonacoPage() {
  const { theme } = useTheme();

  const [language, setLanguage] = useState<MonacoLanguage>("typescript");
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
      automaticLayout: true,
      readOnly: true,
      originalEditable: false,
      minimap: { enabled: false },
      renderOverviewRuler: false,
      wordWrap: "on",
    }),
    []
  );

  const editorHeight = "calc(100dvh - 12rem)";

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-100 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="flex flex-1 flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Monaco Diff Editor Sandbox</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Review the side-by-side, read-only diff editor configuration we ship inside cmux.
          </p>
        </header>

        <section className="flex flex-1 flex-col gap-6 lg:flex-row">
          <aside className="flex w-full flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 lg:w-80">
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Language
              </label>
              <select
                value={language}
                onChange={(event) => {
                  const nextLanguage = event.target.value;
                  if (isMonacoLanguage(nextLanguage)) {
                    setLanguage(nextLanguage);
                  }
                }}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500 dark:focus:ring-neutral-700"
              >
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
              <p>
                The sample diff below mirrors the read-only experience our agents see when
                reviewing code changes.
              </p>
              <p>
                Toggle languages to confirm syntax highlighting and Monaco worker
                registration remain healthy.
              </p>
            </div>
          </aside>

          <div className="flex-1 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            {isEditorReady ? (
              <DiffEditor
                height={editorHeight}
                language={language}
                original={defaultOriginal}
                modified={defaultModified}
                theme={editorTheme}
                options={diffOptions}
              />
            ) : (
              <div
                className="flex items-center justify-center text-sm text-neutral-500 dark:text-neutral-400"
                style={{ height: editorHeight }}
              >
                Loading Monaco diff editor…
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
