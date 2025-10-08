import clsx from "clsx";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

interface ResizableRowsProps {
  top: React.ReactNode;
  bottom: React.ReactNode;
  storageKey?: string;
  defaultTopHeight?: number; // px
  minTop?: number; // px
  maxTop?: number; // px
  separatorHeight?: number; // px
  className?: string;
  separatorClassName?: string;
}

export function ResizableRows({
  top,
  bottom,
  storageKey = "resizableRowsHeight",
  defaultTopHeight = 400,
  minTop = 200,
  maxTop = 800,
  separatorHeight = 6,
  className,
  separatorClassName,
}: ResizableRowsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerTopRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [topHeight, setTopHeight] = useState<number>(() => {
    const stored = storageKey ? localStorage.getItem(storageKey) : null;
    const parsed = stored ? Number.parseInt(stored, 10) : defaultTopHeight;
    if (Number.isNaN(parsed)) return defaultTopHeight;
    return Math.min(Math.max(parsed, minTop), maxTop);
  });

  useEffect(() => {
    if (storageKey) localStorage.setItem(storageKey, String(topHeight));
  }, [topHeight, storageKey]);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (rafIdRef.current != null) return;
      rafIdRef.current = window.requestAnimationFrame(() => {
        rafIdRef.current = null;
        const containerTop = containerTopRef.current;
        const clientY = e.clientY;
        const newHeight = Math.min(
          Math.max(clientY - containerTop, minTop),
          maxTop
        );
        setTopHeight(newHeight);
      });
    },
    [maxTop, minTop]
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
          if (prev === "__unset__") el.style.removeProperty("pointer-events");
          else el.style.pointerEvents = prev;
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
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        containerTopRef.current = rect.top;
      }
      // Disable pointer events on iframes while dragging
      const iframes = Array.from(document.querySelectorAll("iframe"));
      for (const el of iframes) {
        if (el instanceof HTMLIFrameElement) {
          const current = el.style.pointerEvents;
          el.dataset.prevPointerEvents = current ? current : "__unset__";
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

  return (
    <div ref={containerRef} className={clsx(`flex flex-col w-full relative`, className)}>
      <div
        className="shrink-0 w-full"
        style={
          {
            height: `${topHeight}px`,
            minHeight: `${topHeight}px`,
            maxHeight: `${topHeight}px`,
            userSelect: isResizing ? ("none" as const) : undefined,
          } as CSSProperties
        }
      >
        {top}
      </div>
      <div className="w-full block bg-neutral-200 dark:bg-neutral-800 h-[1px]"></div>
      <div className="flex-1 w-full">{bottom}</div>
      <div
        role="separator"
        aria-orientation="horizontal"
        onMouseDown={startResizing}
        className={clsx(
          "absolute inset-x-0 cursor-row-resize bg-transparent hover:bg-neutral-200 dark:hover:bg-neutral-800 active:bg-neutral-300 dark:active:bg-neutral-800",
          separatorClassName
        )}
        style={{
          height: `${separatorHeight}px`,
          minHeight: `${separatorHeight}px`,
          transform: `translateY(calc(${topHeight}px - 50%))`,
          zIndex: 10,
        }}
        title="Resize"
      />
    </div>
  );
}

export default ResizableRows;
