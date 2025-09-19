import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { isElectron } from "@/lib/electron";
import { cn } from "@/lib/utils";

interface ElectronWebContentsViewProps {
  src: string;
  className?: string;
  style?: CSSProperties;
  backgroundColor?: string;
  fallback?: ReactNode;
  borderRadius?: number;
  suspended?: boolean;
  persistKey?: string;
  retainOnUnmount?: boolean;
}

interface BoundsPayload {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SyncState {
  bounds: BoundsPayload;
  visible: boolean;
}

function getWebContentsBridge() {
  if (typeof window === "undefined") return null;
  return window.cmux?.webContentsView ?? null;
}

function rectToBounds(rect: DOMRect): BoundsPayload {
  return {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.max(0, Math.round(rect.width)),
    height: Math.max(0, Math.round(rect.height)),
  };
}

export function ElectronWebContentsView({
  src,
  className,
  style,
  backgroundColor,
  fallback,
  borderRadius,
  suspended = false,
  persistKey,
  retainOnUnmount,
}: ElectronWebContentsViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewIdRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastSyncRef = useRef<SyncState | null>(null);
  const latestSrcRef = useRef(src);
  const latestStyleRef = useRef<{ backgroundColor?: string; borderRadius?: number }>({
    backgroundColor,
    borderRadius,
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Keep latest src accessible without forcing effect recreation.
  useEffect(() => {
    latestSrcRef.current = src;
  }, [src]);

  useEffect(() => {
    latestStyleRef.current = { backgroundColor, borderRadius };
  }, [backgroundColor, borderRadius]);

  const cancelScheduledSync = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const syncBounds = useCallback(() => {
    if (!isElectron) return;
    const bridge = getWebContentsBridge();
    const id = viewIdRef.current;
    const container = containerRef.current;
    if (!bridge || id === null || !container) return;

    const rect = container.getBoundingClientRect();
    const bounds = rectToBounds(rect);
    const visible = !suspended && bounds.width > 0 && bounds.height > 0;
    const prev = lastSyncRef.current;
    if (
      prev &&
      prev.visible === visible &&
      prev.bounds.x === bounds.x &&
      prev.bounds.y === bounds.y &&
      prev.bounds.width === bounds.width &&
      prev.bounds.height === bounds.height
    ) {
      return;
    }

    void bridge
      .setBounds({
        id,
        bounds,
        visible,
      })
      .catch((err) => {
        console.warn("Failed to sync WebContentsView bounds", err);
      });
    lastSyncRef.current = { bounds, visible };
  }, [suspended]);

  const scheduleBoundsSync = useCallback(() => {
    if (!isElectron) return;
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      syncBounds();
    });
  }, [syncBounds]);

  const persistKeyRef = useRef<string | undefined>(persistKey);
  const retainOnUnmountRef = useRef<boolean>(retainOnUnmount ?? persistKey !== undefined);
  const skipInitialLoadRef = useRef<boolean>(false);

  persistKeyRef.current = persistKey;
  retainOnUnmountRef.current = retainOnUnmount ?? persistKey !== undefined;

  const releaseView = useCallback(
    (options?: { persist?: boolean }) => {
      cancelScheduledSync();
      const id = viewIdRef.current;
      if (id === null) return;
      viewIdRef.current = null;
      lastSyncRef.current = null;
      skipInitialLoadRef.current = false;
      const bridge = getWebContentsBridge();
      if (!bridge) return;
      const persistFlag = options?.persist ?? retainOnUnmountRef.current;
      const releaseFn = typeof bridge.release === "function" ? bridge.release : null;
      if (releaseFn) {
        void releaseFn({ id, persist: persistFlag }).catch((err) => {
          console.warn(
            persistFlag
              ? "Failed to release WebContentsView"
              : "Failed to dispose WebContentsView",
            err
          );
        });
        return;
      }
      if (!persistFlag) {
        void bridge
          .destroy(id)
          .catch((err) => {
            console.warn("Failed to destroy WebContentsView", err);
          });
        return;
      }
      void bridge
        .destroy(id)
        .catch((err) => {
          console.warn("Failed to destroy WebContentsView", err);
        });
    },
    [cancelScheduledSync]
  );

  // Mount/unmount lifecycle for the native view.
  useEffect(() => {
    if (!isElectron) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;
    const bridge = getWebContentsBridge();
    if (!bridge) return undefined;

    let disposed = false;
    setErrorMessage(null);

    const initialBounds = rectToBounds(container.getBoundingClientRect());

    const { backgroundColor: initialBackground, borderRadius: initialRadius } = latestStyleRef.current;

    void bridge
      .create({
        url: latestSrcRef.current,
        bounds: initialBounds,
        backgroundColor: initialBackground,
        borderRadius: initialRadius,
        persistKey: persistKeyRef.current,
      })
      .then((result) => {
        if (disposed) {
          void bridge.destroy(result.id).catch(() => undefined);
          return;
        }
        viewIdRef.current = result.id;
        skipInitialLoadRef.current = Boolean(result.restored);
        scheduleBoundsSync();
      })
      .catch((err) => {
        console.error("Failed to create WebContentsView", err);
        setErrorMessage("Unable to create Electron WebContentsView");
      });

    return () => {
      disposed = true;
      releaseView();
    };
  }, [releaseView, scheduleBoundsSync]);

  // React to src changes without recreating the native view.
  useEffect(() => {
    if (!isElectron) return;
    const bridge = getWebContentsBridge();
    const id = viewIdRef.current;
    if (!bridge || id === null) return;
    if (skipInitialLoadRef.current) {
      skipInitialLoadRef.current = false;
      return;
    }
    void bridge
      .loadURL(id, src)
      .catch((err) => {
        console.warn("Failed to load URL in WebContentsView", err);
      });
  }, [src]);

  useEffect(() => {
    if (!isElectron) return;
    const bridge = getWebContentsBridge();
    const id = viewIdRef.current;
    if (!bridge || id === null) return;
    if (backgroundColor === undefined && borderRadius === undefined) return;
    void bridge
      .updateStyle({ id, backgroundColor, borderRadius })
      .catch((err) => {
        console.warn("Failed to update WebContentsView style", err);
      });
  }, [backgroundColor, borderRadius]);

  // Keep bounds in sync on layout changes.
  useEffect(() => {
    if (!isElectron) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    scheduleBoundsSync();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        scheduleBoundsSync();
      });
      resizeObserver.observe(container);
    }

    const handleScroll = () => {
      scheduleBoundsSync();
    };

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);

    let mutationObserver: MutationObserver | null = null;
    if (typeof MutationObserver !== "undefined") {
      mutationObserver = new MutationObserver(() => {
        scheduleBoundsSync();
      });
      const observed: HTMLElement[] = [];
      let node: HTMLElement | null = container;
      while (node) {
        mutationObserver.observe(node, {
          attributes: true,
          attributeFilter: ["style", "class"],
        });
        observed.push(node);
        node = node.parentElement;
      }
    }

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
      mutationObserver?.disconnect();
    };
  }, [scheduleBoundsSync]);

  useLayoutEffect(() => {
    if (!isElectron) return;
    scheduleBoundsSync();
  }, [scheduleBoundsSync]);

  useEffect(() => {
    if (!isElectron) return;
    scheduleBoundsSync();
  }, [scheduleBoundsSync, suspended]);

  const shouldShowFallback = !isElectron || errorMessage !== null;

  return (
    <div
      ref={containerRef}
      className={cn("relative h-full w-full", className)}
      style={{ ...style, borderRadius }}
      data-role="electron-web-contents-view"
      data-suspended={suspended ? "true" : "false"}
    >
      {shouldShowFallback ? (
        <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-neutral-300 bg-white/80 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-300">
          {errorMessage ?? fallback ?? "Open this view in the Electron app to see the embedded page."}
        </div>
      ) : null}
    </div>
  );
}
