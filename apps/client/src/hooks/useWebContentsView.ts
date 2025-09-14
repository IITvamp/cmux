import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isElectron } from "@/lib/electron";

type WcvEvent =
  | { type: "loading"; loading: boolean }
  | { type: "nav-state"; url: string; title: string; canGoBack: boolean; canGoForward: boolean }
  | { type: "did-finish-load" }
  | { type: "load-failed"; code: number; desc: string; url: string };

export type WebContentsViewState = {
  id: number | null;
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  loading: boolean;
};

export type UseWebContentsViewOptions = {
  initialUrl?: string;
};

export function useWebContentsView(opts?: UseWebContentsViewOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [id, setId] = useState<number | null>(null);
  const [state, setState] = useState<WebContentsViewState>({
    id: null,
    url: "",
    title: "",
    canGoBack: false,
    canGoForward: false,
    loading: false,
  });

  // Create/destroy the view
  useEffect(() => {
    if (!isElectron) return;
    const cmux = (window as unknown as { cmux?: unknown }).cmux as
      | undefined
      | {
          wcv: {
            create: () => Promise<{ id: number }>;
            destroy: (id: number) => Promise<{ ok: boolean }>;
            attach: (id: number) => Promise<{ ok: boolean }>;
            setBounds: (
              id: number,
              bounds: { x: number; y: number; width: number; height: number }
            ) => Promise<{ ok: boolean }>;
            loadURL: (id: number, url: string) => Promise<{ ok: boolean }>;
            onEvent: (id: number, cb: (payload: WcvEvent) => void) => () => void;
          };
        };
    if (!cmux?.wcv) return;

    let unsub: (() => void) | null = null;
    let mounted = true;
    let createdId: number | null = null;
    (async () => {
      const created = await cmux.wcv.create();
      if (!mounted) return;
      createdId = created.id;
      setId(created.id);
      setState((s) => ({ ...s, id: created.id }));
      // Subscribe to events
      unsub = cmux.wcv.onEvent(created.id, (payload: WcvEvent) => {
        if (payload.type === "loading") {
          setState((s) => ({ ...s, loading: payload.loading }));
        } else if (payload.type === "nav-state") {
          setState((s) => ({
            ...s,
            url: payload.url,
            title: payload.title,
            canGoBack: payload.canGoBack,
            canGoForward: payload.canGoForward,
          }));
        }
      });

      // Attach view now; bounds will be set by observer effect below
      await cmux.wcv.attach(created.id);

      if (opts?.initialUrl) {
        await cmux.wcv.loadURL(created.id, opts.initialUrl);
      }
    })().catch(() => {
      // ignore
    });

    return () => {
      mounted = false;
      if (unsub) unsub();
      if (createdId != null) void cmux?.wcv.destroy(createdId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep bounds in sync with the container element rect
  useEffect(() => {
    if (!isElectron) return;
    if (id == null) return;
    const el = containerRef.current;
    const cmux = (window as unknown as { cmux?: unknown }).cmux as
      | undefined
      | {
          wcv: {
            setBounds: (
              id: number,
              bounds: { x: number; y: number; width: number; height: number }
            ) => Promise<{ ok: boolean }>;
          };
        };
    if (!cmux?.wcv) return;

    const update = () => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.floor(rect.left));
      const y = Math.max(0, Math.floor(rect.top));
      const width = Math.max(0, Math.floor(rect.width));
      const height = Math.max(0, Math.floor(rect.height));
      void cmux.wcv.setBounds(id, { x, y, width, height });
    };

    update();

    const obs = new ResizeObserver(() => update());
    if (el) obs.observe(el);
    const onScroll = () => update();
    const onResize = () => update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      if (el) obs.unobserve(el);
      obs.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [id]);

  const api = useMemo(() => {
    const cmux = (window as unknown as { cmux?: unknown }).cmux as
      | undefined
      | {
          wcv: {
            loadURL: (id: number, url: string) => Promise<{ ok: boolean }>;
            goBack: (id: number) => Promise<{ ok: boolean }>;
            goForward: (id: number) => Promise<{ ok: boolean }>;
            reload: (id: number) => Promise<{ ok: boolean }>;
            openDevTools: (id: number) => Promise<{ ok: boolean }>;
            closeDevTools: (id: number) => Promise<{ ok: boolean }>;
            focus: (id: number) => Promise<{ ok: boolean }>;
          };
        };
    return {
      navigate: (url: string) => (id != null && cmux?.wcv ? cmux.wcv.loadURL(id, url) : Promise.resolve({ ok: false as const })),
      back: () => (id != null && cmux?.wcv ? cmux.wcv.goBack(id) : Promise.resolve({ ok: false as const })),
      forward: () => (id != null && cmux?.wcv ? cmux.wcv.goForward(id) : Promise.resolve({ ok: false as const })),
      reload: () => (id != null && cmux?.wcv ? cmux.wcv.reload(id) : Promise.resolve({ ok: false as const })),
      openDevTools: () => (id != null && cmux?.wcv ? cmux.wcv.openDevTools(id) : Promise.resolve({ ok: false as const })),
      closeDevTools: () => (id != null && cmux?.wcv ? cmux.wcv.closeDevTools(id) : Promise.resolve({ ok: false as const })),
      focus: () => (id != null && cmux?.wcv ? cmux.wcv.focus(id) : Promise.resolve({ ok: false as const })),
    } as const;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return {
    containerRef,
    state,
    api,
    isElectron,
  } as const;
}
