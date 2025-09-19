import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { FloatingPane } from "@/components/floating-pane";
import { PersistentWebView } from "@/components/persistent-webview";
import { isElectron } from "@/lib/electron";
import { getTaskRunPreviewPersistKey } from "@/lib/persistent-webview-keys";
import { api } from "@cmux/convex/api";
import { typedZid } from "@cmux/shared/utils/typed-zid";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import z from "zod";

const paramsSchema = z.object({
  taskId: typedZid("tasks"),
  runId: typedZid("taskRuns"),
  port: z.string(),
});

export const Route = createFileRoute(
  "/_layout/$teamSlugOrId/task/$taskId/run/$runId/preview/$port"
)({
  component: PreviewPage,
  params: {
    parse: paramsSchema.parse,
    stringify: (params) => {
      return {
        taskId: params.taskId,
        runId: params.runId,
        port: params.port,
      };
    },
  },
});

function PreviewPage() {
  const { taskId, teamSlugOrId, runId, port } = Route.useParams();


  const taskRuns = useQuery(api.taskRuns.getByTask, {
    teamSlugOrId,
    taskId,
  });

  // Get the specific run
  const selectedRun = useMemo(() => {
    return taskRuns?.find((run) => run._id === runId);
  }, [runId, taskRuns]);

  // Find the service URL for the requested port
  const previewUrl = useMemo(() => {
    if (!selectedRun?.networking) return null;
    const portNum = parseInt(port, 10);
    const service = selectedRun.networking.find(
      (s) => s.port === portNum && s.status === "running"
    );
    return service?.url;
  }, [selectedRun, port]);

  const persistKey = useMemo(() => {
    return getTaskRunPreviewPersistKey(runId, port);
  }, [runId, port]);

  const paneBorderRadius = 6;

  return (
    <FloatingPane>
      {previewUrl ? (
        isElectron ? (
          <ElectronPreviewBrowser
            persistKey={persistKey}
            initialUrl={previewUrl}
            borderRadius={paneBorderRadius}
          />
        ) : (
          <PersistentWebView
            persistKey={persistKey}
            src={previewUrl}
            className="h-full w-full border-0"
            borderRadius={paneBorderRadius}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-downloads"
          />
        )
      ) : (
        <div className="flex items-center justify-center h-full bg-white dark:bg-neutral-950">
          <div className="text-center">
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
              {selectedRun
                ? `Port ${port} is not available for this run`
                : "Loading..."}
            </p>
            {selectedRun?.networking && selectedRun.networking.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-2">
                  Available ports:
                </p>
                <div className="flex gap-2 justify-center">
                  {selectedRun.networking
                    .filter((s) => s.status === "running")
                    .map((service) => (
                      <span
                        key={service.port}
                        className="px-2 py-1 text-xs bg-neutral-100 dark:bg-neutral-800 rounded"
                      >
                        {service.port}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </FloatingPane>
  );
}

interface ElectronPreviewBrowserProps {
  persistKey: string;
  initialUrl: string;
  borderRadius: number;
}

function ElectronPreviewBrowser({
  persistKey,
  initialUrl,
  borderRadius,
}: ElectronPreviewBrowserProps) {
  const [committedUrl, setCommittedUrl] = useState(initialUrl);
  const [displayUrl, setDisplayUrl] = useState(initialUrl);
  const [addressValue, setAddressValue] = useState(initialUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  const isEditingRef = useRef(false);

  useEffect(() => {
    if (committedUrl === initialUrl) {
      return;
    }
    setCommittedUrl(initialUrl);
    setDisplayUrl(initialUrl);
    setPageTitle(null);
    if (!isEditingRef.current) {
      setAddressValue(initialUrl);
    }
  }, [initialUrl, committedUrl]);

  useEffect(() => {
    if (typeof window === "undefined" || !isElectron) {
      return;
    }
    const api = window.cmux?.webContentsView;
    if (!api) {
      return;
    }

    const unsubscribe = api.onEvent((event) => {
      if (event.persistKey !== persistKey) {
        return;
      }

      switch (event.type) {
        case "did-attach": {
          if (event.url) {
            setDisplayUrl(event.url);
            if (!isEditingRef.current) {
              setAddressValue(event.url);
            }
          }
          setIsLoading(Boolean(event.isLoading));
          setPageTitle(event.title ?? null);
          break;
        }
        case "did-navigate":
        case "did-navigate-in-page": {
          if (event.url) {
            setDisplayUrl(event.url);
            if (!isEditingRef.current) {
              setAddressValue(event.url);
            }
          }
          if (event.type === "did-navigate" && event.title) {
            setPageTitle(event.title ?? null);
          }
          break;
        }
        case "page-title-updated": {
          setPageTitle(event.title ?? null);
          break;
        }
        case "did-start-loading": {
          setIsLoading(true);
          break;
        }
        case "did-stop-loading":
        case "did-finish-load": {
          setIsLoading(false);
          break;
        }
        case "did-fail-load": {
          setIsLoading(false);
          break;
        }
        default:
          break;
      }
    });

    void api
      .getState({ persistKey })
      .then((result) => {
        if (!result?.ok || !result.state) return;
        const { url, isLoading: loading, title } = result.state;
        if (url) {
          setDisplayUrl(url);
          if (!isEditingRef.current) {
            setAddressValue(url);
          }
        }
        setIsLoading(Boolean(loading));
        setPageTitle(title ?? null);
      })
      .catch(() => undefined);

    return () => {
      try {
        unsubscribe();
      } catch {
        // ignore cleanup errors
      }
    };
  }, [persistKey]);

  useEffect(() => {
    if (isEditingRef.current) {
      return;
    }
    setAddressValue(displayUrl);
  }, [displayUrl]);

  useEffect(() => {
    let interval: number | undefined;
    let timeout: number | undefined;

    if (isLoading) {
      setProgress((prev) => (prev <= 0 ? 8 : prev));
      interval = window.setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            return prev;
          }
          const increment = Math.max(1, (90 - prev) * 0.12);
          return Math.min(prev + increment, 90);
        });
      }, 120);
    } else {
      setProgress((prev) => (prev > 0 ? 100 : prev));
      timeout = window.setTimeout(() => {
        setProgress(0);
      }, 320);
    }

    return () => {
      if (interval !== undefined) {
        window.clearInterval(interval);
      }
      if (timeout !== undefined) {
        window.clearTimeout(timeout);
      }
    };
  }, [isLoading]);

  const handleAddressFocus = useCallback(() => {
    isEditingRef.current = true;
  }, []);

  const handleAddressBlur = useCallback(() => {
    isEditingRef.current = false;
    setAddressValue(displayUrl);
  }, [displayUrl]);

  const handleAddressChange = useCallback((value: string) => {
    setAddressValue(value);
  }, []);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const input = addressValue.trim();
      if (!input) {
        return;
      }
      const nextUrl = normalizeAddressInput(input);
      setCommittedUrl(nextUrl);
      setDisplayUrl(nextUrl);
      setIsLoading(true);
      if (!isEditingRef.current) {
        setAddressValue(nextUrl);
      }
    },
    [addressValue]
  );

  const handleDevTools = useCallback(() => {
    if (typeof window === "undefined" || !isElectron) {
      return;
    }
    const api = window.cmux?.webContentsView;
    if (!api) {
      return;
    }
    void api.openDevTools({ persistKey, mode: "detach" }).catch(() => undefined);
  }, [persistKey]);

  const omnibarLabel = pageTitle ?? "Preview";
  const showProgress = progress > 0 && (isLoading || progress >= 100);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[inherit] bg-white dark:bg-neutral-950">
      <div className="relative border-b border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-0.5 transition-opacity"
          style={{ opacity: showProgress ? 1 : 0 }}
        >
          <div
            className="h-full rounded-full bg-neutral-900 transition-[width] duration-150 ease-out dark:bg-neutral-100"
            style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
          />
        </div>
        <form className="flex items-center gap-2" onSubmit={handleSubmit}>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 shadow-sm focus-within:border-neutral-500 focus-within:ring-1 focus-within:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:focus-within:border-neutral-300 dark:focus-within:ring-neutral-300">
            <div className="flex shrink-0 items-center">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: isLoading ? "#16a34a" : "#22c55e",
                  boxShadow: isLoading
                    ? "0 0 0 4px rgba(34,197,94,0.15)"
                    : "0 0 0 0 rgba(34,197,94,0)",
                  transition: "box-shadow 200ms ease, background-color 200ms ease",
                }}
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {omnibarLabel}
              </span>
              <input
                className="min-w-0 truncate bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                value={addressValue}
                onChange={(event) => handleAddressChange(event.target.value)}
                onFocus={handleAddressFocus}
                onBlur={handleAddressBlur}
                spellCheck={false}
              />
            </div>
          </div>
          <button
            type="submit"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            Go
          </button>
          <button
            type="button"
            onClick={handleDevTools}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            DevTools
          </button>
        </form>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <PersistentWebView
          persistKey={persistKey}
          src={committedUrl}
          className="h-full w-full border-0"
          borderRadius={borderRadius}
          backgroundColor="#ffffff"
        />
      </div>
    </div>
  );
}

function normalizeAddressInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "https://duckduckgo.com/";
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+-.]*:/.test(trimmed);
  if (hasScheme) return trimmed;
  if (trimmed.includes(" ")) {
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  }
  return `https://${trimmed}`;
}
