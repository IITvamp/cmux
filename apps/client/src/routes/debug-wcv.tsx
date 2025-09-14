import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useWebContentsView } from "@/hooks/useWebContentsView";
import { isElectron } from "@/lib/electron";

export const Route = createFileRoute("/debug-wcv")({
  component: DebugWcv,
});

function DebugWcv() {
  const defaultUrl = "https://example.com";
  const { containerRef, state, api } = useWebContentsView({ initialUrl: defaultUrl });
  const [addr, setAddr] = useState<string>(defaultUrl);

  if (!isElectron) {
    return (
      <div className="p-4">
        <h1 className="text-lg font-semibold">WebContentsView Demo</h1>
        <p className="text-neutral-600 dark:text-neutral-300 mt-2">
          This demo only runs in the Electron app.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-lg font-semibold">WebContentsView Demo</h1>

      <div className="flex items-center gap-2">
        <button
          className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 disabled:opacity-50"
          onClick={() => void api.back()}
          disabled={!state.canGoBack}
          title="Back"
        >
          ←
        </button>
        <button
          className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 disabled:opacity-50"
          onClick={() => void api.forward()}
          disabled={!state.canGoForward}
          title="Forward"
        >
          →
        </button>
        <button
          className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200"
          onClick={() => void api.reload()}
          title="Reload"
        >
          ⟳
        </button>
        <button
          className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200"
          onClick={() => void api.openDevTools()}
          title="Open DevTools"
        >
          DevTools
        </button>
        <input
          className="flex-1 px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void api.navigate(addr);
          }}
          placeholder="https://…"
        />
        <button
          className="px-3 py-1 rounded bg-neutral-900 text-white dark:bg-neutral-200 dark:text-neutral-900"
          onClick={() => void api.navigate(addr)}
        >
          Go
        </button>
      </div>

      <div className="text-sm text-neutral-600 dark:text-neutral-300">
        <span className="mr-2">{state.loading ? "Loading…" : ""}</span>
        <span className="font-medium">{state.title}</span>
        <span className="ml-2 text-neutral-500">{state.url}</span>
      </div>

      <div
        ref={containerRef}
        className="w-full h-[60vh] min-h-[300px] border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-900"
      />
    </div>
  );
}

