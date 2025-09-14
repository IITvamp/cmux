import { useCallback, useEffect, useRef, useState } from "react";
import { isElectron } from "../lib/electron";

export interface WebContentsViewOptions {
  url?: string;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  autoResize?: boolean;
  visible?: boolean;
  backgroundColor?: string;
  preload?: string;
}

export interface WebContentsViewAPI {
  create: (options: WebContentsViewOptions) => Promise<number>;
  destroy: (id: number) => Promise<void>;
  setBounds: (id: number, bounds: WebContentsViewOptions["bounds"]) => Promise<void>;
  setVisible: (id: number, visible: boolean) => Promise<void>;
  loadURL: (id: number, url: string) => Promise<void>;
  reload: (id: number) => Promise<void>;
  goBack: (id: number) => Promise<void>;
  goForward: (id: number) => Promise<void>;
  executeJavaScript: (id: number, code: string) => Promise<unknown>;
  insertCSS: (id: number, css: string) => Promise<void>;
  focus: (id: number) => Promise<void>;
  blur: (id: number) => Promise<void>;
  canGoBack: (id: number) => Promise<boolean>;
  canGoForward: (id: number) => Promise<boolean>;
  getURL: (id: number) => Promise<string>;
  getTitle: (id: number) => Promise<string>;
  isLoading: (id: number) => Promise<boolean>;
  stop: (id: number) => Promise<void>;
  openDevTools: (id: number) => Promise<void>;
  closeDevTools: (id: number) => Promise<void>;
}

export interface WebContentsViewState {
  id: number | null;
  url: string;
  title: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  error: string | null;
}

export interface UseWebContentsViewResult {
  state: WebContentsViewState;
  actions: {
    loadURL: (url: string) => Promise<void>;
    reload: () => Promise<void>;
    goBack: () => Promise<void>;
    goForward: () => Promise<void>;
    stop: () => Promise<void>;
    focus: () => Promise<void>;
    blur: () => Promise<void>;
    setBounds: (bounds: WebContentsViewOptions["bounds"]) => Promise<void>;
    setVisible: (visible: boolean) => Promise<void>;
    executeJavaScript: (code: string) => Promise<unknown>;
    insertCSS: (css: string) => Promise<void>;
    openDevTools: () => Promise<void>;
    closeDevTools: () => Promise<void>;
  };
}

const getWebContentsViewAPI = (): WebContentsViewAPI | null => {
  if (!isElectron) return null;
  
  const w = window as unknown as {
    cmux?: {
      webContentsView?: WebContentsViewAPI;
    };
  };
  
  return w.cmux?.webContentsView || null;
};

export function useWebContentsView(
  options?: WebContentsViewOptions
): UseWebContentsViewResult {
  const [state, setState] = useState<WebContentsViewState>({
    id: null,
    url: options?.url || "",
    title: "",
    loading: false,
    canGoBack: false,
    canGoForward: false,
    error: null,
  });

  const api = useRef<WebContentsViewAPI | null>(getWebContentsViewAPI());
  const cleanupRef = useRef<(() => void) | null>(null);

  // Create WebContentsView on mount
  useEffect(() => {
    if (!api.current) {
      setState(prev => ({ ...prev, error: "WebContentsView API not available" }));
      return;
    }

    let cancelled = false;
    let viewId: number | null = null;

    const createView = async () => {
      try {
        const id = await api.current!.create(options || {});
        if (cancelled) {
          await api.current!.destroy(id);
          return;
        }
        
        viewId = id;
        setState(prev => ({ ...prev, id, error: null }));

        // Load initial URL if provided
        if (options?.url) {
          setState(prev => ({ ...prev, loading: true }));
          await api.current!.loadURL(id, options.url);
          
          // Update state after loading
          const [url, title, loading, canGoBack, canGoForward] = await Promise.all([
            api.current!.getURL(id),
            api.current!.getTitle(id),
            api.current!.isLoading(id),
            api.current!.canGoBack(id),
            api.current!.canGoForward(id),
          ]);
          
          if (!cancelled) {
            setState(prev => ({
              ...prev,
              url,
              title,
              loading,
              canGoBack,
              canGoForward,
            }));
          }
        }
      } catch (error) {
        if (!cancelled) {
          setState(prev => ({
            ...prev,
            error: error instanceof Error ? error.message : "Failed to create WebContentsView",
          }));
        }
      }
    };

    createView();

    // Set up event listeners
    const setupListeners = () => {
      if (!viewId || !api.current) return;

      // Listen for navigation events
      const w = window as unknown as {
        cmux?: {
          on?: (event: string, callback: (...args: unknown[]) => void) => () => void;
        };
      };

      const unsubscribers: Array<() => void> = [];

      if (w.cmux?.on) {
        // Listen for page title updates
        unsubscribers.push(
          w.cmux.on(`wcv:page-title-updated:${viewId}`, (title: unknown) => {
            setState(prev => ({ ...prev, title: String(title || "") }));
          })
        );

        // Listen for navigation state changes
        unsubscribers.push(
          w.cmux.on(`wcv:did-navigate:${viewId}`, async () => {
            if (!api.current || !viewId) return;
            try {
              const [url, canGoBack, canGoForward] = await Promise.all([
                api.current.getURL(viewId),
                api.current.canGoBack(viewId),
                api.current.canGoForward(viewId),
              ]);
              setState(prev => ({ ...prev, url, canGoBack, canGoForward }));
            } catch (error) {
              console.error("Failed to update navigation state:", error);
            }
          })
        );

        // Listen for loading state changes
        unsubscribers.push(
          w.cmux.on(`wcv:did-start-loading:${viewId}`, () => {
            setState(prev => ({ ...prev, loading: true }));
          })
        );

        unsubscribers.push(
          w.cmux.on(`wcv:did-stop-loading:${viewId}`, () => {
            setState(prev => ({ ...prev, loading: false }));
          })
        );

        // Listen for errors
        unsubscribers.push(
          w.cmux.on(`wcv:did-fail-load:${viewId}`, (errorDescription: unknown) => {
            setState(prev => ({
              ...prev,
              loading: false,
              error: String(errorDescription || "Page failed to load"),
            }));
          })
        );
      }

      cleanupRef.current = () => {
        unsubscribers.forEach(unsub => unsub());
      };
    };

    // Delay listener setup to ensure view is created
    const listenerTimeout = setTimeout(() => {
      if (viewId) setupListeners();
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(listenerTimeout);
      cleanupRef.current?.();
      
      if (viewId && api.current) {
        api.current.destroy(viewId).catch(error => {
          console.error("Failed to destroy WebContentsView:", error);
        });
      }
    };
  }, []); // Only run on mount/unmount

  // Action handlers
  const actions = {
    loadURL: useCallback(async (url: string) => {
      if (!api.current || !state.id) return;
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        await api.current.loadURL(state.id, url);
      } catch (error) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : "Failed to load URL",
        }));
      }
    }, [state.id]),

    reload: useCallback(async () => {
      if (!api.current || !state.id) return;
      try {
        setState(prev => ({ ...prev, loading: true }));
        await api.current.reload(state.id);
      } catch (error) {
        console.error("Failed to reload:", error);
      }
    }, [state.id]),

    goBack: useCallback(async () => {
      if (!api.current || !state.id || !state.canGoBack) return;
      try {
        await api.current.goBack(state.id);
      } catch (error) {
        console.error("Failed to go back:", error);
      }
    }, [state.id, state.canGoBack]),

    goForward: useCallback(async () => {
      if (!api.current || !state.id || !state.canGoForward) return;
      try {
        await api.current.goForward(state.id);
      } catch (error) {
        console.error("Failed to go forward:", error);
      }
    }, [state.id, state.canGoForward]),

    stop: useCallback(async () => {
      if (!api.current || !state.id) return;
      try {
        await api.current.stop(state.id);
        setState(prev => ({ ...prev, loading: false }));
      } catch (error) {
        console.error("Failed to stop:", error);
      }
    }, [state.id]),

    focus: useCallback(async () => {
      if (!api.current || !state.id) return;
      try {
        await api.current.focus(state.id);
      } catch (error) {
        console.error("Failed to focus:", error);
      }
    }, [state.id]),

    blur: useCallback(async () => {
      if (!api.current || !state.id) return;
      try {
        await api.current.blur(state.id);
      } catch (error) {
        console.error("Failed to blur:", error);
      }
    }, [state.id]),

    setBounds: useCallback(async (bounds: WebContentsViewOptions["bounds"]) => {
      if (!api.current || !state.id || !bounds) return;
      try {
        await api.current.setBounds(state.id, bounds);
      } catch (error) {
        console.error("Failed to set bounds:", error);
      }
    }, [state.id]),

    setVisible: useCallback(async (visible: boolean) => {
      if (!api.current || !state.id) return;
      try {
        await api.current.setVisible(state.id, visible);
      } catch (error) {
        console.error("Failed to set visibility:", error);
      }
    }, [state.id]),

    executeJavaScript: useCallback(async (code: string) => {
      if (!api.current || !state.id) return;
      try {
        return await api.current.executeJavaScript(state.id, code);
      } catch (error) {
        console.error("Failed to execute JavaScript:", error);
        throw error;
      }
    }, [state.id]),

    insertCSS: useCallback(async (css: string) => {
      if (!api.current || !state.id) return;
      try {
        await api.current.insertCSS(state.id, css);
      } catch (error) {
        console.error("Failed to insert CSS:", error);
      }
    }, [state.id]),

    openDevTools: useCallback(async () => {
      if (!api.current || !state.id) return;
      try {
        await api.current.openDevTools(state.id);
      } catch (error) {
        console.error("Failed to open DevTools:", error);
      }
    }, [state.id]),

    closeDevTools: useCallback(async () => {
      if (!api.current || !state.id) return;
      try {
        await api.current.closeDevTools(state.id);
      } catch (error) {
        console.error("Failed to close DevTools:", error);
      }
    }, [state.id]),
  };

  return { state, actions };
}