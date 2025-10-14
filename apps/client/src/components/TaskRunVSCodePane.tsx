import clsx from "clsx";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { PersistentWebView } from "@/components/persistent-webview";
import {
  TASK_RUN_IFRAME_ALLOW,
  TASK_RUN_IFRAME_SANDBOX,
} from "@/lib/preloadTaskRunIframes";

type LoadState = "idle" | "loading" | "ready" | "error";

interface TaskRunVSCodePaneProps {
  workspaceUrl: string | null;
  persistKey: string;
  className?: string;
  style?: CSSProperties;
  iframeClassName?: string;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

export function TaskRunVSCodePane({
  workspaceUrl,
  persistKey,
  className,
  style,
  iframeClassName,
  onReady,
  onError,
}: TaskRunVSCodePaneProps) {
  const [loadState, setLoadState] = useState<LoadState>(
    workspaceUrl ? "loading" : "idle",
  );
  const [lastError, setLastError] = useState<Error | null>(null);
  const lastWorkspaceRef = useRef<string | null>(workspaceUrl);

  useEffect(() => {
    if (workspaceUrl) {
      if (lastWorkspaceRef.current !== workspaceUrl) {
        lastWorkspaceRef.current = workspaceUrl;
        setLoadState("loading");
        setLastError(null);
      }
    } else {
      lastWorkspaceRef.current = null;
      setLoadState("idle");
      setLastError(null);
    }
  }, [workspaceUrl]);

  const handleLoad = useCallback(() => {
    setLoadState("ready");
    setLastError(null);
    onReady?.();
  }, [onReady]);

  const handleError = useCallback(
    (error: Error) => {
      setLoadState("error");
      setLastError(error);
      onError?.(error);
    },
    [onError],
  );

  const overlayContent = useMemo(() => {
    if (loadState === "ready") {
      return null;
    }

    if (loadState === "error") {
      return (
        <div className="flex flex-col items-center gap-2 rounded-md border border-red-200/80 bg-red-50/90 px-4 py-3 text-center dark:border-red-900/70 dark:bg-red-950/60">
          <AlertCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
          <p className="text-sm font-medium text-red-600 dark:text-red-200">
            We couldn't load VS Code.
          </p>
          <p className="text-xs text-red-500/80 dark:text-red-300/80">
            {lastError?.message ?? "Try refreshing the page or restarting the run."}
          </p>
        </div>
      );
    }

    const headline = workspaceUrl
      ? "VS Code is starting up…"
      : "Setting up VS Code workspace…";
    const body = workspaceUrl
      ? "Hang tight while we connect to your development environment."
      : "We're waiting for the workspace URL to become available.";

    return (
      <div
        className="flex flex-col items-center gap-3 rounded-md border border-neutral-200/70 bg-white/90 px-4 py-3 text-center shadow-sm backdrop-blur-sm dark:border-neutral-800/65 dark:bg-neutral-950/75"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-5 w-5 animate-spin text-blue-500" aria-hidden="true" />
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-100">
          {headline}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{body}</p>
      </div>
    );
  }, [loadState, workspaceUrl, lastError]);

  const shouldShowOverlay = loadState !== "ready";

  return (
    <div
      className={clsx(
        "pl-1 flex flex-col grow bg-neutral-50 dark:bg-black",
        className,
      )}
      style={style}
    >
      <div className="flex flex-col grow min-h-0 border-l border-neutral-200 dark:border-neutral-800">
        <div className="flex flex-row grow min-h-0 relative">
          {workspaceUrl ? (
            <PersistentWebView
              persistKey={persistKey}
              src={workspaceUrl}
              className="grow flex relative"
              iframeClassName={clsx("select-none", iframeClassName)}
              sandbox={TASK_RUN_IFRAME_SANDBOX}
              allow={TASK_RUN_IFRAME_ALLOW}
              retainOnUnmount
              suspended={loadState !== "ready"}
              onLoad={handleLoad}
              onError={handleError}
            />
          ) : (
            <div className="grow" />
          )}

          {shouldShowOverlay ? (
            <div
              className={clsx(
                "absolute inset-0 flex items-center justify-center transition-opacity",
                "bg-neutral-50/80 dark:bg-black/70",
                {
                  "opacity-100": shouldShowOverlay,
                  "opacity-0": !shouldShowOverlay,
                },
              )}
            >
              {overlayContent}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
