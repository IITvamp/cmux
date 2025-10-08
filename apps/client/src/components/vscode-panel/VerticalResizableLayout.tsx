import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface VerticalResizableLayoutProps {
  topPanel: ReactNode;
  bottomPanel: ReactNode;
  defaultTopHeight?: number;
  minTopHeight?: number;
  minBottomHeight?: number;
}

export function VerticalResizableLayout({
  topPanel,
  bottomPanel,
  defaultTopHeight = 400,
  minTopHeight = 200,
  minBottomHeight = 300,
}: VerticalResizableLayoutProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const [topHeight, setTopHeight] = useState<number>(() => {
    const stored = localStorage.getItem("vscodeTopHeight");
    const parsed = stored ? Number.parseInt(stored, 10) : defaultTopHeight;
    if (Number.isNaN(parsed)) return defaultTopHeight;
    return Math.max(parsed, minTopHeight);
  });

  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    localStorage.setItem("vscodeTopHeight", String(topHeight));
  }, [topHeight]);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (rafIdRef.current != null) return;
      rafIdRef.current = window.requestAnimationFrame(() => {
        rafIdRef.current = null;
        const container = containerRef.current;
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const containerHeight = containerRect.height;
        const newTopHeight = e.clientY - containerRect.top;

        // Ensure we respect minimum heights for both panels
        const maxTopHeight = containerHeight - minBottomHeight;
        const constrainedHeight = Math.min(
          Math.max(newTopHeight, minTopHeight),
          maxTopHeight
        );

        setTopHeight(constrainedHeight);
      });
    },
    [minTopHeight, minBottomHeight]
  );

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = "";
    document.body.classList.remove("select-none");

    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    // Restore iframe pointer events
    const iframes = Array.from(document.querySelectorAll("iframe"));
    for (const el of iframes) {
      if (el instanceof HTMLIFrameElement) {
        const prev = el.dataset.prevPointerEvents;
        if (prev !== undefined) {
          if (prev === "__unset__") {
            el.style.removeProperty("pointer-events");
          } else {
            el.style.pointerEvents = prev;
          }
          delete el.dataset.prevPointerEvents;
        } else {
          el.style.removeProperty("pointer-events");
        }
      }
    }

    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", stopResizing);
  }, [onMouseMove]);

  const startResizing = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsResizing(true);
      document.body.style.cursor = "row-resize";
      document.body.classList.add("select-none");

      // Disable pointer events on iframes during drag
      const iframes = Array.from(document.querySelectorAll("iframe"));
      for (const el of iframes) {
        if (el instanceof HTMLIFrameElement) {
          const current = el.style.pointerEvents;
          el.dataset.prevPointerEvents = current || "__unset__";
          el.style.pointerEvents = "none";
        }
      }

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", stopResizing);
    },
    [onMouseMove, stopResizing]
  );

  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [onMouseMove, stopResizing]);

  const resetHeight = useCallback(
    () => setTopHeight(defaultTopHeight),
    [defaultTopHeight]
  );

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full w-full overflow-hidden"
    >
      {/* Top Panel - VSCode */}
      <div
        className="flex-shrink-0 overflow-hidden"
        style={{
          height: `${topHeight}px`,
        }}
      >
        {topPanel}
      </div>

      {/* Resize Handle */}
      <div
        role="separator"
        aria-orientation="horizontal"
        title="Drag to resize (double-click to reset)"
        onMouseDown={startResizing}
        onDoubleClick={resetHeight}
        className="relative flex-shrink-0 cursor-row-resize hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
        style={{
          height: "8px",
          background: isResizing
            ? "rgb(163 163 163 / 0.5)"
            : "rgb(115 115 115 / 0.2)",
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-1 rounded-full bg-neutral-400 dark:bg-neutral-500" />
        </div>
      </div>

      {/* Bottom Panel - Chat/Content */}
      <div className="flex-1 min-h-0 overflow-hidden">{bottomPanel}</div>
    </div>
  );
}
