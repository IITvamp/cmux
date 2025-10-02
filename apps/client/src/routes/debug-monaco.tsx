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
  const [originalValue, setOriginalValue] = useState(defaultOriginal);
  const [modifiedValue, setModifiedValue] = useState(defaultModified);
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
      readOnly: false,
      originalEditable: true,
      minimap: { enabled: false },
      renderOverviewRuler: false,
      wordWrap: "on",
    }),
    []
  );

  return (
    <div className="min-h-dvh bg-neutral-100 px-4 py-10 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Monaco Diff Editor Sandbox</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Adjust the inputs below to test the diff editor configuration used in cmux.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
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

            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Original
              </label>
              <textarea
                value={originalValue}
                onChange={(event) => setOriginalValue(event.target.value)}
                spellCheck={false}
                className="h-52 w-full resize-none rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm font-mono text-neutral-900 shadow-sm focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500 dark:focus:ring-neutral-700"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Modified
              </label>
              <textarea
                value={modifiedValue}
                onChange={(event) => setModifiedValue(event.target.value)}
                spellCheck={false}
                className="h-52 w-full resize-none rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm font-mono text-neutral-900 shadow-sm focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500 dark:focus:ring-neutral-700"
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="h-full overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              {isEditorReady ? (
                <DiffEditor
                  height="600px"
                  language={language}
                  original={originalValue}
                  modified={modifiedValue}
                  theme={editorTheme}
                  options={diffOptions}
                />
              ) : (
                <div className="flex h-[600px] items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
                  Loading Monaco diff editor…
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
