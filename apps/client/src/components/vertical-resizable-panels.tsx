import clsx from "clsx";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

interface VerticalResizablePanelsProps {
  top: ReactNode;
  bottom: ReactNode;
  /** Whether the top panel should be rendered. When false the bottom panel fills the container. */
  topVisible?: boolean;
  /** Minimum height for the top panel in pixels. */
  minTopHeight?: number;
  /** Minimum height for the bottom panel in pixels. */
  minBottomHeight?: number;
  /** Storage key for persisting the top panel height in localStorage. */
  storageKey?: string;
  /** Initial height for the top panel when no stored value exists. */
  initialTopHeight?: number;
  className?: string;
}

const IFRAME_POINTER_EVENT_DATA_KEY = "prevPointerEvents" as const;

function disableIframePointerEvents(): void {
  if (typeof document === "undefined") return;
  const iframes = Array.from(document.querySelectorAll("iframe"));
  for (const element of iframes) {
    if (!(element instanceof HTMLIFrameElement)) continue;
    const current = element.style.pointerEvents;
    element.dataset[IFRAME_POINTER_EVENT_DATA_KEY] = current || "__unset__";
    element.style.pointerEvents = "none";
  }
}

function restoreIframePointerEvents(): void {
  if (typeof document === "undefined") return;
  const iframes = Array.from(document.querySelectorAll("iframe"));
  for (const element of iframes) {
    if (!(element instanceof HTMLIFrameElement)) continue;
    const stored = element.dataset[IFRAME_POINTER_EVENT_DATA_KEY];
    if (stored === undefined) continue;
    if (stored === "__unset__") {
      element.style.removeProperty("pointer-events");
    } else {
      element.style.pointerEvents = stored;
    }
    delete element.dataset[IFRAME_POINTER_EVENT_DATA_KEY];
  }
}

export function VerticalResizablePanels({
  top,
  bottom,
  topVisible = true,
  minTopHeight = 200,
  minBottomHeight = 240,
  storageKey,
  initialTopHeight = 420,
  className,
}: VerticalResizablePanelsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerTopRef = useRef(0);
  const containerHeightRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  const [isResizing, setIsResizing] = useState(false);
  const [topHeight, setTopHeight] = useState(() => {
    if (typeof window === "undefined" || !storageKey) {
      return initialTopHeight;
    }
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return initialTopHeight;
    const parsed = Number.parseInt(stored, 10);
    if (Number.isNaN(parsed)) return initialTopHeight;
    return parsed;
  });

  const effectiveTopHeight = useMemo(() => {
    if (!topVisible) return topHeight;
    return Math.max(topHeight, minTopHeight);
  }, [topVisible, topHeight, minTopHeight]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, String(Math.round(topHeight)));
  }, [storageKey, topHeight]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const maxTop = rect.height - minBottomHeight;
      if (maxTop <= 0) return;
      setTopHeight((current) => {
        if (current > maxTop) {
          return Math.max(minTopHeight, Math.floor(maxTop));
        }
        return current;
      });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [minBottomHeight, minTopHeight]);

  const onMouseMove = useCallback(
    (event: MouseEvent) => {
      if (rafIdRef.current !== null) return;
      rafIdRef.current = window.requestAnimationFrame(() => {
        rafIdRef.current = null;
        const containerTop = containerTopRef.current;
        const containerHeight = containerHeightRef.current;
        if (containerHeight <= 0) return;

        const desired = event.clientY - containerTop;
        const maxTop = containerHeight - minBottomHeight;
        if (maxTop <= 0) return;
        const clamped = Math.min(
          Math.max(desired, minTopHeight),
          maxTop
        );
        setTopHeight(clamped);
      });
    },
    [minBottomHeight, minTopHeight]
  );

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    document.body.style.cursor = "";
    document.body.classList.remove("select-none");
    restoreIframePointerEvents();
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", stopResizing);
  }, [onMouseMove]);

  const startResizing = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!topVisible) return;
      event.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      setIsResizing(true);
      const rect = container.getBoundingClientRect();
      containerTopRef.current = rect.top;
      containerHeightRef.current = rect.height;
      document.body.style.cursor = "row-resize";
      document.body.classList.add("select-none");
      disableIframePointerEvents();
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", stopResizing);
    },
    [onMouseMove, stopResizing, topVisible]
  );

  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stopResizing);
      restoreIframePointerEvents();
    };
  }, [onMouseMove, stopResizing]);

  return (
    <div
      ref={containerRef}
      className={clsx("flex h-full min-h-0 flex-col", className)}
    >
      {topVisible && (
        <>
          <div
            className="flex min-h-0 flex-col overflow-hidden"
            style={{
              height: `${effectiveTopHeight}px`,
              minHeight: `${minTopHeight}px`,
            }}
          >
            {top}
          </div>
          <div
            role="separator"
            aria-orientation="horizontal"
            className={clsx(
              "relative flex h-3 cursor-row-resize items-center justify-center border-y border-transparent transition-colors",
              isResizing
                ? "bg-neutral-100 dark:bg-neutral-800/60"
                : "hover:bg-neutral-100 dark:hover:bg-neutral-800/40"
            )}
            onMouseDown={startResizing}
          >
            <div className="pointer-events-none flex h-0 items-center justify-center">
              <div className="pointer-events-auto h-1 w-14 rounded-full bg-neutral-300 transition-colors dark:bg-neutral-600" />
            </div>
          </div>
        </>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{bottom}</div>
    </div>
  );
}

