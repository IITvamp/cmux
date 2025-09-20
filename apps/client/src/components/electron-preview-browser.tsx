import { ChevronDown, Globe, Inspect, Loader2 } from "lucide-react";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PersistentWebView } from "@/components/persistent-webview";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
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

const DEVTOOLS_DOCK_OPTIONS: Array<{
  label: string;
  mode: ElectronDevToolsMode;
}> = [
  { label: "Dock to bottom", mode: "bottom" },
  { label: "Dock to right", mode: "right" },
  { label: "Open in separate window", mode: "undocked" },
];

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

function useLoadingProgress(isLoading: boolean) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    if (isLoading) {
      setVisible(true);
      setProgress((prev) => (prev <= 0 ? 0.08 : prev));
      interval = setInterval(() => {
        setProgress((prev) => {
          const next = prev + (1 - prev) * 0.18;
          return Math.min(next, 0.95);
        });
      }, 120);
    } else {
      setProgress((prev) => (prev === 0 ? 0 : 1));
      timeout = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 260);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
  }, [isLoading]);

  return { progress, visible };
}

export function ElectronPreviewBrowser({
  persistKey,
  src,
  borderRadius,
}: ElectronPreviewBrowserProps) {
  const [viewHandle, setViewHandle] = useState<NativeViewHandle | null>(null);
  const [addressValue, setAddressValue] = useState(src);
  const [committedUrl, setCommittedUrl] = useState(src);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);
  const [devtoolsMode, setDevtoolsMode] =
    useState<ElectronDevToolsMode>("bottom");
  const [lastError, setLastError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { progress, visible } = useLoadingProgress(isLoading);

  useEffect(() => {
    setAddressValue(src);
    setCommittedUrl(src);
    setLastError(null);
  }, [src]);

  const applyState = useCallback(
    (state: ElectronWebContentsState) => {
      setCommittedUrl(state.url);
      if (!isEditing) {
        setAddressValue(state.url);
      }
      setIsLoading(state.isLoading);
      setDevtoolsOpen(state.isDevToolsOpened);
      if (state.isLoading) {
        setLastError(null);
      }
    },
    [isEditing]
  );

  useEffect(() => {
    if (!viewHandle) return;
    const getState = window.cmux?.webContentsView?.getState;
    if (!getState) return;
    let disposed = false;
    void getState(viewHandle.id)
      .then((result) => {
        if (disposed) return;
        if (result?.ok && result.state) {
          applyState(result.state);
        }
      })
      .catch((error) => {
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
        if (event.type === "state") {
          applyState(event.state);
          return;
        }
        if (event.type === "load-failed" && event.isMainFrame) {
          setLastError(event.errorDescription || "Failed to load page");
        }
      }
    );
    return () => {
      unsubscribe?.();
    };
  }, [applyState, viewHandle]);

  const handleViewReady = useCallback((info: NativeViewHandle) => {
    setViewHandle(info);
    setLastError(null);
  }, []);

  const handleViewDestroyed = useCallback(() => {
    setViewHandle(null);
    setIsLoading(false);
    setDevtoolsOpen(false);
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
      setLastError(null);
      setIsEditing(false);
      inputRef.current?.blur();
      void window.cmux?.webContentsView
        ?.loadURL(viewHandle.id, target)
        .catch((error) => {
          console.warn("Failed to navigate WebContentsView", error);
        });
    },
    [addressValue, viewHandle]
  );

  const handleInputFocus = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      setIsEditing(true);
      event.currentTarget.select();
    },
    []
  );

  const handleInputBlur = useCallback(() => {
    setIsEditing(false);
    setAddressValue(committedUrl);
  }, [committedUrl]);

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.currentTarget.blur();
        setAddressValue(committedUrl);
      }
    },
    [committedUrl]
  );

  const handleToggleDevTools = useCallback(() => {
    if (!viewHandle) return;
    if (devtoolsOpen) {
      void window.cmux?.webContentsView
        ?.closeDevTools(viewHandle.id)
        .catch((error) => {
          console.warn("Failed to close DevTools", error);
        });
    } else {
      void window.cmux?.webContentsView
        ?.openDevTools(viewHandle.id, { mode: devtoolsMode })
        .catch((error) => {
          console.warn("Failed to open DevTools", error);
        });
    }
  }, [devtoolsMode, devtoolsOpen, viewHandle]);

  const handleOpenDevToolsWithMode = useCallback(
    (mode: ElectronDevToolsMode) => {
      if (!viewHandle) return;
      setDevtoolsMode(mode);
      void window.cmux?.webContentsView
        ?.openDevTools(viewHandle.id, { mode })
        .catch((error) => {
          console.warn("Failed to open DevTools with mode", error);
        });
    },
    [viewHandle]
  );

  const handleCloseDevTools = useCallback(() => {
    if (!viewHandle) return;
    void window.cmux?.webContentsView
      ?.closeDevTools(viewHandle.id)
      .catch((error) => {
        console.warn("Failed to close DevTools", error);
      });
  }, [viewHandle]);

  const devtoolsTooltipLabel = devtoolsOpen
    ? "Close DevTools"
    : "Open DevTools";

  const progressStyles = useMemo(() => {
    return {
      width: `${Math.min(1, Math.max(progress, 0)) * 100}%`,
      opacity: visible ? 1 : 0,
    } satisfies CSSProperties;
  }, [progress, visible]);

  return (
    <div className="flex h-full flex-col">
      <div className="">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div
            className={cn(
              "relative flex items-center gap-2 border border-neutral-200 bg-white px-3 font-mono",
              "focus-within:ring-2 focus-within:ring-primary/15",
              "dark:border-neutral-800 dark:bg-neutral-900"
            )}
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin text-primary" />
            ) : (
              <Globe className="size-4 text-neutral-400 dark:text-neutral-500" />
            )}
            <input
              ref={inputRef}
              value={addressValue}
              onChange={(event) => setAddressValue(event.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              className="flex-1 bg-transparent text-[11px] text-neutral-900 outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-600"
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
                    className={cn(
                      "size-9 rounded-full text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100",
                      devtoolsOpen && "text-primary hover:text-primary"
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
              <Dropdown.Root>
                <Dropdown.Trigger
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full text-neutral-500 transition-colors",
                    "hover:bg-neutral-100 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-primary/20",
                    "dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100",
                    !viewHandle && "cursor-not-allowed opacity-50"
                  )}
                  disabled={!viewHandle}
                  aria-label="DevTools docking options"
                >
                  <ChevronDown className="size-4" />
                </Dropdown.Trigger>
                <Dropdown.Portal>
                  <Dropdown.Positioner sideOffset={6}>
                    <Dropdown.Popup>
                      <Dropdown.Arrow />
                      {DEVTOOLS_DOCK_OPTIONS.map((option) => (
                        <Dropdown.Item
                          key={option.mode}
                          onClick={(event) => {
                            event.preventDefault();
                            handleOpenDevToolsWithMode(option.mode);
                          }}
                        >
                          {option.label}
                        </Dropdown.Item>
                      ))}
                      <Dropdown.Item
                        onClick={(event) => {
                          event.preventDefault();
                          handleCloseDevTools();
                        }}
                        disabled={!devtoolsOpen}
                        className="text-neutral-500 dark:text-neutral-400"
                      >
                        Close DevTools
                      </Dropdown.Item>
                    </Dropdown.Popup>
                  </Dropdown.Positioner>
                </Dropdown.Portal>
              </Dropdown.Root>
            </div>
            <div
              className="pointer-events-none absolute inset-x-2 top-0 h-[3px] overflow-hidden rounded-full bg-neutral-200/70 transition-opacity dark:bg-neutral-800/80"
              style={{ opacity: visible ? 1 : 0 }}
            >
              <div
                className="h-full rounded-full bg-primary transition-[opacity,width]"
                style={progressStyles}
              />
            </div>
          </div>
        </form>
        {lastError ? (
          <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive dark:border-red-700/40 dark:bg-red-500/15">
            Failed to load page: {lastError}
          </div>
        ) : null}
      </div>
      <div className="flex-1 overflow-hidden bg-white dark:bg-neutral-950">
        <PersistentWebView
          persistKey={persistKey}
          src={src}
          className="h-full w-full border-0"
          borderRadius={borderRadius}
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-downloads"
          onElectronViewReady={handleViewReady}
          onElectronViewDestroyed={handleViewDestroyed}
        />
      </div>
    </div>
  );
}
