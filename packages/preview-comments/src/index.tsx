"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Position = {
  x: number;
  y: number;
};

export type PreviewCommentsWidgetProps = {
  initialPosition?: Position; // top-left starting position in px
  openByDefault?: boolean;
  title?: string;
};

export function PreviewCommentsWidget({
  initialPosition,
  openByDefault = false,
  title = "Preview Comments",
}: PreviewCommentsWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(
    null,
  );

  const [position, setPosition] = useState<Position>(() => {
    if (typeof window === "undefined") return { x: 24, y: 24 };
    // Default bottom-right-ish; we'll convert to top-left below in effect
    const defaultX = Math.max(24, window.innerWidth - 360);
    const defaultY = Math.max(24, window.innerHeight - 280);
    return initialPosition ?? { x: defaultX, y: defaultY };
  });
  const [open, setOpen] = useState<boolean>(openByDefault);

  const clampIntoViewport = useCallback((next: Position): Position => {
    if (typeof window === "undefined") return next;
    const margin = 8;
    const width = containerRef.current?.offsetWidth ?? 320;
    const height = containerRef.current?.offsetHeight ?? (open ? 240 : 56);
    const maxX = Math.max(0, window.innerWidth - width - margin);
    const maxY = Math.max(0, window.innerHeight - height - margin);
    return {
      x: Math.min(Math.max(margin, next.x), maxX),
      y: Math.min(Math.max(margin, next.y), maxY),
    };
  }, [open]);

  useEffect(() => {
    function onResize() {
      setPosition((p) => clampIntoViewport(p));
    }
    if (typeof window !== "undefined") {
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }
  }, [clampIntoViewport]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // left click only
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragStartRef.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    (e.target as Element).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start || start.pointerId !== e.pointerId) return;
    const next = { x: e.clientX - start.offsetX, y: e.clientY - start.offsetY };
    setPosition(clampIntoViewport(next));
  }, [clampIntoViewport]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (start && start.pointerId === e.pointerId) {
      dragStartRef.current = null;
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ left: position.x, top: position.y }}
      className="fixed z-[9999] select-none"
      aria-live="polite"
    >
      <div
        className="w-[320px] rounded-xl shadow-lg border border-neutral-200 bg-white text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
      >
        {/* Header / Drag handle */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="cursor-grab active:cursor-grabbing rounded-t-xl px-3 py-2 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60"
        >
          <div className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium">{title}</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Collapse comments" : "Expand comments"}
            className="text-xs px-2 py-1 rounded-md border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            {open ? "Hide" : "Show"}
          </button>
        </div>

        {/* Body */}
        {open ? (
          <div className="p-3 space-y-3">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              Leave a comment about this preview.
            </div>
            <textarea
              rows={3}
              placeholder="Type a comment…"
              className="w-full resize-none rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-neutral-500"
            />
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                This is a demo widget.
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                onClick={() => {
                  // no-op demo submit
                }}
              >
                Submit
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full rounded-b-xl px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="Open comments"
          >
            Open comments
          </button>
        )}
      </div>
    </div>
  );
}

