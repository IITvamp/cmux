import {
  ArrowLeft,
  ArrowRight,
  Inspect,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PersistentWebView } from "@/components/persistent-webview";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type {
  ElectronDevToolsMode,
  ElectronWebContentsEvent,
  ElectronWebContentsState,
} from "@/types/electron-webcontents";
import clsx from "clsx";

interface ElectronPreviewBrowserProps {
  persistKey: string;
  src: string;
  borderRadius?: number;
}

interface NativeViewHandle {
  id: number;
  webContentsId: number;
  restored: boolean;
}

type NavigationLoadError = {
  kind: "navigation";
  url: string;
  description: string;
  code: number;
};

type HttpLoadError = {
  kind: "http";
  url: string;
  statusCode: number;
  statusText?: string;
};

type LoadError = NavigationLoadError | HttpLoadError;

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return trimmed;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  return `https://${trimmed}`;
}

interface LoadErrorDisplay {
  title: string;
  description: string;
  badgeLabel: string;
  details: Array<{ label: string; value: string }>;
}

function describeHttpError(error: HttpLoadError): LoadErrorDisplay {
  const { statusCode, statusText, url } = error;
  let title = "Request failed";
  let description =
    "The server responded with an error. Try refreshing the page or checking the service logs.";

  if (statusCode === 404) {
    title = "Page not found";
    description =
      "We couldn't find that page. Double-check the URL or make sure the route is available.";
  } else if (statusCode === 401 || statusCode === 403) {
    title = "Access denied";
    description =
      "This page requires authentication or additional permissions. Sign in or update the request headers.";
  } else if (statusCode >= 500) {
    title = "Server error";
    description =
      "The server encountered an error while handling the request. Check the service logs or try again.";
  } else if (statusCode >= 400) {
    title = "Request blocked";
    description =
      "The server rejected the request. Review the request payload or try again.";
  }

  const statusDetail = statusText
    ? `HTTP ${statusCode} · ${statusText}`
    : `HTTP ${statusCode}`;

  return {
    title,
    description,
    badgeLabel: statusDetail,
    details: [
      { label: "Status", value: statusDetail },
      { label: "URL", value: url },
    ],
  };
}

type NavigationMatch = {
  test: RegExp;
  title: string;
  description: string;
};

const NAVIGATION_ERROR_MAPPINGS: NavigationMatch[] = [
  {
    test: /ERR_NAME_NOT_RESOLVED/i,
    title: "Domain not found",
    description:
      "The domain name couldn't be resolved. Verify the hostname or update your DNS settings.",
  },
  {
    test: /ERR_CONNECTION_REFUSED/i,
    title: "Connection refused",
    description:
      "The server refused the connection. Make sure the service is running and accepting connections.",
  },
  {
    test: /ERR_CONNECTION_TIMED_OUT/i,
    title: "Connection timed out",
    description:
      "The server took too long to respond. Check the server status or network connectivity.",
  },
  {
    test: /ERR_INTERNET_DISCONNECTED/i,
    title: "No internet connection",
    description:
      "We couldn't reach the internet. Check your network connection and try again.",
  },
  {
    test: /ERR_SSL_PROTOCOL_ERROR|ERR_CERT/i,
    title: "Secure connection failed",
    description:
      "The secure connection could not be established. Verify the TLS certificate or try HTTP.",
  },
  {
    test: /ERR_ADDRESS_UNREACHABLE|ERR_CONNECTION_RESET/i,
    title: "Host unreachable",
    description:
      "We couldn't reach the host. Confirm the service address and network routes.",
  },
];

function describeNavigationError(error: NavigationLoadError): LoadErrorDisplay {
  const normalizedDescription = error.description ?? "";
  const match = NAVIGATION_ERROR_MAPPINGS.find(({ test }) =>
    test.test(normalizedDescription),
  );

  const title = match?.title ?? "Failed to load page";
  const description =
    match?.description ??
    "Something went wrong while loading this page. Try refreshing or check the network logs.";

  const badgeLabel = `Code ${error.code}`;

  const details: Array<{ label: string; value: string }> = [
    { label: "Error", value: normalizedDescription || `Code ${error.code}` },
    { label: "URL", value: error.url },
  ];

  return {
    title,
    description,
    badgeLabel,
    details,
  };
}

function describeLoadError(error: LoadError | null): LoadErrorDisplay {
  if (!error) {
    return {
      title: "Preview unavailable",
      description:
        "Open this view in the Electron app to inspect the preview, or retry after the embedded view is ready.",
      badgeLabel: "",
      details: [],
    };
  }
  if (error.kind === "http") {
    return describeHttpError(error);
  }
  return describeNavigationError(error);
}

function useLoadingProgress(isLoading: boolean) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let hideTimeout: ReturnType<typeof setTimeout> | null = null;
    let resetTimeout: ReturnType<typeof setTimeout> | null = null;

    if (isLoading) {
      setVisible(true);
      setProgress((prev) => {
        if (prev <= 0 || prev >= 1) {
          return 0.08;
        }
        return prev;
      });
      interval = setInterval(() => {
        setProgress((prev) => {
          const next = prev + (1 - prev) * 0.18;
          return Math.min(next, 0.95);
        });
      }, 120);
    } else {
      setProgress((prev) => (prev === 0 ? 0 : 1));
      hideTimeout = setTimeout(() => {
        setVisible(false);
        resetTimeout = setTimeout(() => {
          setProgress(0);
        }, 500);
      }, 300);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (hideTimeout) clearTimeout(hideTimeout);
      if (resetTimeout) clearTimeout(resetTimeout);
    };
  }, [isLoading]);

  return { progress, visible };
}

export function ElectronPreviewBrowser({
  persistKey,
  src,
}: ElectronPreviewBrowserProps) {
  const [viewHandle, setViewHandle] = useState<NativeViewHandle | null>(null);
  const [addressValue, setAddressValue] = useState(src);
  const [committedUrl, setCommittedUrl] = useState(src);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);
  const [devtoolsMode] = useState<ElectronDevToolsMode>("right");
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { progress, visible } = useLoadingProgress(isLoading);

  useEffect(() => {
    setAddressValue(src);
    setCommittedUrl(src);
    setLoadError(null);
    setCanGoBack(false);
    setCanGoForward(false);
  }, [src]);

  const applyState = useCallback(
    (state: ElectronWebContentsState, reason?: string) => {
      console.log("[ElectronPreviewBrowser] applyState", { state, reason });
      setCommittedUrl(state.url);
      if (!isEditing) {
        setAddressValue(state.url);
      }
      setIsLoading(state.isLoading);
      setDevtoolsOpen(state.isDevToolsOpened);
      setCanGoBack(Boolean(state.canGoBack));
      setCanGoForward(Boolean(state.canGoForward));
      // Only clear errors when starting a new navigation (did-start-loading),
      // not during the same navigation (did-navigate can have isLoading=true with errors)
      if (state.isLoading && reason === "did-start-loading") {
        console.log("[ElectronPreviewBrowser] clearing loadError on new navigation");
        setLoadError(null);
      }
    },
    [isEditing],
  );

  useEffect(() => {
    if (!viewHandle) return;
    const getState = window.cmux.webContentsView.getState;
    if (!getState) return;
    let disposed = false;
    void getState(viewHandle.id)
      .then((result) => {
        if (disposed) return;
        if (result?.ok && result.state) {
          applyState(result.state);
        }
      })
      .catch((error: unknown) => {
        console.warn("Failed to get WebContentsView state", error);
      });
    return () => {
      disposed = true;
    };
  }, [applyState, viewHandle]);

  useEffect(() => {
    if (!viewHandle) return;
    const subscribe = window.cmux?.webContentsView?.onEvent;
    if (!subscribe) return;
    const unsubscribe = subscribe(
      viewHandle.id,
      (event: ElectronWebContentsEvent) => {
        console.log("[ElectronPreviewBrowser] Event", event);
        if (event.type === "state") {
          applyState(event.state, event.reason);
          return;
        }
        if (event.type === "load-failed" && event.isMainFrame) {
          const description = event.errorDescription || "Failed to load page";
          const url = event.validatedURL || committedUrl;
          setLoadError({
            kind: "navigation",
            url,
            code: event.errorCode,
            description,
          });
          console.log("[ElectronPreviewBrowser] navigation error", {
            url,
            code: event.errorCode,
            description,
          });
          return;
        }
        if (event.type === "load-http-error") {
          const url = event.url || committedUrl;
          const errorObj = {
            kind: "http" as const,
            url,
            statusCode: event.statusCode,
            statusText: event.statusText,
          };
          console.log("[ElectronPreviewBrowser] http error - setting loadError", {
            url,
            statusCode: event.statusCode,
            statusText: event.statusText,
            errorObj,
          });
          setLoadError(errorObj);
          return;
        }
      },
    );
    return () => {
      unsubscribe?.();
    };
  }, [applyState, committedUrl, viewHandle]);

  const handleViewReady = useCallback((info: NativeViewHandle) => {
    setViewHandle(info);
    setLoadError(null);
  }, []);

  const handleViewDestroyed = useCallback(() => {
    setViewHandle(null);
    setIsLoading(false);
    setDevtoolsOpen(false);
    setCanGoBack(false);
    setCanGoForward(false);
    setLoadError(null);
  }, []);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!viewHandle) return;
      const raw = addressValue.trim();
      if (!raw) return;
      const target = normalizeUrl(raw);
      setCommittedUrl(target);
      setAddressValue(target);
      setLoadError(null);
      setIsEditing(false);
      inputRef.current?.blur();
      void window.cmux?.webContentsView
        ?.loadURL(viewHandle.id, target)
        .catch((error: unknown) => {
          console.warn("Failed to navigate WebContentsView", error);
        });
    },
    [addressValue, viewHandle],
  );

  const initialSelectHandled = useRef(false);
  const inputFocused = useRef(false);

  const handleInputFocus = useCallback(
    (_event: React.FocusEvent<HTMLInputElement>) => {
      setIsEditing(true);
      inputFocused.current = true;
      // event.currentTarget.select();
    },
    [],
  );

  const handleInputBlur = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      initialSelectHandled.current = false;
      inputFocused.current = false;
      setIsEditing(false);
      setAddressValue(committedUrl);
      const input = event.currentTarget;
      queueMicrotask(() => {
        try {
          const end = input.value.length;
          input.setSelectionRange?.(end, end);
          input.selectionStart = end;
          input.selectionEnd = end;
        } catch {
          // Ignore selection errors on older browsers.
        }
        if (typeof window !== "undefined") {
          window.getSelection?.()?.removeAllRanges?.();
        }
      });
    },
    [committedUrl],
  );

  const handleInputMouseUp = useCallback(
    (event: React.MouseEvent<HTMLInputElement>) => {
      if (initialSelectHandled.current) {
        return;
      }
      initialSelectHandled.current = true;
      event.currentTarget.select();
    },
    [],
  );

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.currentTarget.blur();
        setAddressValue(committedUrl);
      }
    },
    [committedUrl],
  );

  const handleToggleDevTools = useCallback(() => {
    if (!viewHandle) return;
    if (devtoolsOpen) {
      void window.cmux?.webContentsView
        ?.closeDevTools(viewHandle.id)
        .catch((error: unknown) => {
          console.warn("Failed to close DevTools", error);
        });
    } else {
      void window.cmux?.webContentsView
        ?.openDevTools(viewHandle.id, { mode: devtoolsMode })
        .catch((error: unknown) => {
          console.warn("Failed to open DevTools", error);
        });
    }
  }, [devtoolsMode, devtoolsOpen, viewHandle]);

  const handleOpenDevTools = useCallback(() => {
    if (!viewHandle) return;
    setDevtoolsOpen(true);
    void window.cmux?.webContentsView
      ?.openDevTools(viewHandle.id, { mode: devtoolsMode })
      .catch((error: unknown) => {
        console.warn("Failed to open DevTools", error);
      });
  }, [devtoolsMode, viewHandle]);

  const handleGoBack = useCallback(() => {
    if (!viewHandle) return;
    void window.cmux?.webContentsView
      ?.goBack(viewHandle.id)
      .catch((error: unknown) => {
        console.warn("Failed to go back", error);
      });
  }, [viewHandle]);

  const handleGoForward = useCallback(() => {
    if (!viewHandle) return;
    void window.cmux?.webContentsView
      ?.goForward(viewHandle.id)
      .catch((error: unknown) => {
        console.warn("Failed to go forward", error);
      });
  }, [viewHandle]);

  const reloadCurrentView = useCallback(() => {
    setLoadError(null);
    if (viewHandle) {
      void window.cmux?.webContentsView
        ?.reload(viewHandle.id)
        .catch((error: unknown) => {
          console.warn("Failed to reload WebContentsView", error);
        });
      return;
    }

    if (typeof document === "undefined") {
      return;
    }

    const escapedKey =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(persistKey)
        : persistKey.replace(/"/g, '\\"');
    const iframe = document.querySelector<HTMLIFrameElement>(
      `[data-iframe-key="${escapedKey}"] iframe`,
    );
    if (!iframe?.contentWindow) {
      return;
    }
    try {
      iframe.contentWindow.location.reload();
    } catch (error) {
      console.warn("Failed to reload iframe view", error);
    }
  }, [persistKey, viewHandle]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey &&
        key === "r"
      ) {
        event.preventDefault();
        if (event.repeat) return;
        reloadCurrentView();
      }
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [reloadCurrentView]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const off = window.cmux?.on?.("shortcut:preview-reload", () => {
      reloadCurrentView();
    });
    return () => {
      off?.();
    };
  }, [reloadCurrentView]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const show = window.cmux?.ui?.setPreviewReloadVisible;
    if (show) {
      void show(true).catch((error: unknown) => {
        console.warn("Failed to show preview reload menu item", error);
      });
    }
    return () => {
      const hide = window.cmux?.ui?.setPreviewReloadVisible;
      if (hide) {
        void hide(false).catch((error: unknown) => {
          console.warn("Failed to hide preview reload menu item", error);
        });
      }
    };
  }, []);

  // Move WebContentsView offscreen when there's a load error
  useEffect(() => {
    if (!viewHandle) return;
    const setBounds = window.cmux?.webContentsView?.setBounds;
    if (!setBounds) return;

    if (loadError) {
      // Move the view far offscreen so it doesn't obscure the error UI
      void setBounds({
        id: viewHandle.id,
        bounds: { x: 100000, y: 0, width: 1, height: 1 },
        visible: false,
      }).catch((error: unknown) => {
        console.warn("Failed to move WebContentsView offscreen", error);
      });
    }
  }, [loadError, viewHandle]);

  const devtoolsTooltipLabel = devtoolsOpen
    ? "Close DevTools"
    : "Open DevTools";

  const progressStyles = useMemo(() => {
    return {
      width: `${Math.min(1, Math.max(progress, 0)) * 100}%`,
    } satisfies CSSProperties;
  }, [progress]);

  console.log("[ElectronPreviewBrowser] render", { loadError, viewHandle });

  return (
    <div className="flex h-full flex-col">
      <div className="">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div
            className={cn(
              "relative flex items-center gap-1 border border-neutral-200 bg-white px-2 pt-0.5 pb-[3px]",
              "dark:border-neutral-800 dark:bg-neutral-900",
            )}
          >
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-full p-0 text-neutral-600 hover:text-neutral-800 disabled:opacity-30 disabled:hover:text-neutral-400 dark:text-neutral-500 dark:hover:text-neutral-100 dark:disabled:hover:text-neutral-500"
                    onClick={handleGoBack}
                    disabled={!viewHandle || !canGoBack}
                    aria-label="Go back"
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Back</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-full p-0 text-neutral-600 hover:text-neutral-800 disabled:opacity-30 disabled:hover:text-neutral-400 dark:text-neutral-500 dark:hover:text-neutral-100 dark:disabled:hover:text-neutral-500"
                    onClick={handleGoForward}
                    disabled={!viewHandle || !canGoForward}
                    aria-label="Go forward"
                  >
                    <ArrowRight className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Forward</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-full p-0 text-neutral-600 hover:text-neutral-800 disabled:opacity-30 disabled:hover:text-neutral-400 dark:text-neutral-500 dark:hover:text-neutral-100 dark:disabled:hover:text-neutral-500"
                    onClick={() => {
                      if (!viewHandle) return;
                      void window.cmux?.webContentsView
                        ?.reload(viewHandle.id)
                        .catch((error: unknown) => {
                          console.warn(
                            "Failed to reload WebContentsView",
                            error,
                          );
                        });
                    }}
                    disabled={!viewHandle}
                    aria-label="Refresh page"
                  >
                    {isLoading ? (
                      <Loader2 className="size-4 animate-spin text-primary" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Refresh</TooltipContent>
              </Tooltip>
            </div>
            <input
              ref={inputRef}
              value={addressValue}
              onChange={(event) => setAddressValue(event.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onMouseUp={handleInputMouseUp}
              onKeyDown={handleInputKeyDown}
              className="flex-1 bg-neutral-200 dark:bg-neutral-700 px-2 py-px rounded-[5px] text-[13px] text-neutral-800 outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-600 border-[1.7px] border-transparent active:border-neutral-400 focus:border-neutral-400 dark:active:border-neutral-500 dark:focus:border-neutral-500"
              placeholder="Enter a URL"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              disabled={!viewHandle}
            />
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={clsx(
                      "size-7 rounded-full p-0 text-neutral-600 hover:text-neutral-800 disabled:opacity-30 disabled:hover:text-neutral-400 dark:text-neutral-500 dark:hover:text-neutral-100 dark:disabled:hover:text-neutral-500",
                      devtoolsOpen && "text-primary hover:text-primary",
                    )}
                    onClick={handleToggleDevTools}
                    disabled={!viewHandle}
                    aria-label={devtoolsTooltipLabel}
                  >
                    <Inspect className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end">
                  {devtoolsTooltipLabel}
                </TooltipContent>
              </Tooltip>
            </div>
            <div
              className="pointer-events-none absolute inset-x-0 -top-px h-[1.5px] overflow-hidden transition-opacity duration-300"
              style={{ opacity: visible ? 1 : 0 }}
            >
              <div
                className="h-full rounded-full bg-neutral-900/80 dark:bg-neutral-300 transition-[width] duration-200"
                style={progressStyles}
              />
            </div>
          </div>
        </form>
      </div>
      <div className="flex-1 overflow-hidden bg-white dark:bg-neutral-950 pl-[pxpx] border-l">
        <div className="relative h-full w-full">
          <PersistentWebView
            persistKey={persistKey}
            src={src}
            className="h-full w-full border-0"
            borderRadius={0}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-downloads"
            onElectronViewReady={handleViewReady}
            onElectronViewDestroyed={handleViewDestroyed}
            forceWebContentsViewIfElectron
            fallback={
              <PreviewErrorState
                error={loadError}
                variant="embedded"
                onRetry={reloadCurrentView}
                onOpenDevTools={viewHandle ? handleOpenDevTools : undefined}
              />
            }
          />
          {loadError ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 p-6 backdrop-blur-sm dark:bg-neutral-950/85">
              <PreviewErrorState
                error={loadError}
                variant="overlay"
                onRetry={reloadCurrentView}
                onOpenDevTools={viewHandle ? handleOpenDevTools : undefined}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface PreviewErrorStateProps {
  error: LoadError | null;
  variant: "overlay" | "embedded";
  onRetry: () => void;
  onOpenDevTools?: () => void;
}

function PreviewErrorState({
  error,
  variant,
  onRetry,
  onOpenDevTools,
}: PreviewErrorStateProps) {
  const content = describeLoadError(error);
  const hasDetails = content.details.length > 0;
  const hasActions =
    Boolean(error) && (Boolean(onRetry) || Boolean(onOpenDevTools));

  return (
    <div
      className={cn(
        "w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-5 text-neutral-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200",
        variant === "overlay"
          ? "shadow-lg ring-1 ring-neutral-900/5 dark:ring-neutral-100/10"
          : "mx-auto my-6",
      )}
    >
      {content.badgeLabel ? (
        <span className="mb-3 inline-flex items-center rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
          {content.badgeLabel}
        </span>
      ) : null}
      <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
        {content.title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
        {content.description}
      </p>
      {hasDetails ? (
        <dl className="mt-4 space-y-2 text-xs text-neutral-500 dark:text-neutral-400">
          {content.details.map(({ label, value }) => (
            <div key={`${label}-${value}`}>
              <dt className="font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                {label}
              </dt>
              <dd className="mt-0.5 break-words text-neutral-600 dark:text-neutral-300">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {hasActions ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {onRetry ? (
            <Button type="button" size="sm" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
          {onOpenDevTools ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onOpenDevTools}
            >
              Open DevTools
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
