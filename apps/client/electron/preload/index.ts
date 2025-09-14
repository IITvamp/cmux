import { electronAPI } from "@electron-toolkit/preload";
import { contextBridge, ipcRenderer } from "electron";

const api = {};

// Cmux IPC API for Electron server communication
const cmuxAPI = {
  // Register with the server (like socket connection)
  register: (meta: { auth?: string; team?: string; auth_json?: string }) => {
    return ipcRenderer.invoke("cmux:register", meta);
  },

  // RPC call (like socket.emit with acknowledgment)
  rpc: (event: string, ...args: unknown[]) => {
    return ipcRenderer.invoke("cmux:rpc", { event, args });
  },

  // Subscribe to server events
  on: (event: string, callback: (...args: unknown[]) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      ...args: unknown[]
    ) => {
      callback(...args);
    };
    ipcRenderer.on(`cmux:event:${event}`, listener);
    return () => {
      ipcRenderer.removeListener(`cmux:event:${event}`, listener);
    };
  },

  // Unsubscribe from server events
  off: (event: string, callback?: (...args: unknown[]) => void) => {
    if (callback) {
      ipcRenderer.removeListener(`cmux:event:${event}`, callback);
    } else {
      ipcRenderer.removeAllListeners(`cmux:event:${event}`);
    }
  },

  // Socket IPC methods for IPC-based socket communication
  socket: {
    connect: (query: Record<string, string>) => {
      return ipcRenderer.invoke("socket:connect", query);
    },
    disconnect: (socketId: string) => {
      return ipcRenderer.invoke("socket:disconnect", socketId);
    },
    emit: (socketId: string, eventName: string, ...args: unknown[]) => {
      // Pass args as an array to avoid serialization issues
      return ipcRenderer.invoke("socket:emit", socketId, eventName, args);
    },
    on: (socketId: string, eventName: string) => {
      return ipcRenderer.invoke("socket:on", socketId, eventName);
    },
    onEvent: (
      socketId: string,
      callback: (eventName: string, ...args: unknown[]) => void
    ) => {
      ipcRenderer.on(
        `socket:event:${socketId}`,
        (_event, eventName, ...args) => {
          callback(eventName, ...args);
        }
      );
    },
  },
  // UI helpers
  ui: {
    focusWebContents: (id: number) => {
      return ipcRenderer.invoke("cmux:ui:focus-webcontents", id) as Promise<
        { ok: boolean }
      >;
    },
    restoreLastFocusInWebContents: (id: number) => {
      return ipcRenderer.invoke(
        "cmux:ui:webcontents-restore-last-focus",
        id
      ) as Promise<{ ok: boolean }>;
    },
    restoreLastFocusInFrame: (
      contentsId: number,
      frameRoutingId: number,
      frameProcessId: number
    ) => {
      return ipcRenderer.invoke(
        "cmux:ui:frame-restore-last-focus",
        { contentsId, frameRoutingId, frameProcessId }
      ) as Promise<{ ok: boolean }>;
    },
    setCommandPaletteOpen: (open: boolean) => {
      return ipcRenderer.invoke(
        "cmux:ui:set-command-palette-open",
        Boolean(open)
      ) as Promise<{ ok: boolean }>;
    },
    restoreLastFocus: () => {
      return ipcRenderer.invoke(
        "cmux:ui:restore-last-focus"
      ) as Promise<{ ok: boolean }>;
    },
  },
  // WebContentsView API
  webContentsView: {
    create: (options: unknown) => {
      return ipcRenderer.invoke("wcv:create", options) as Promise<number>;
    },
    destroy: (id: number) => {
      return ipcRenderer.invoke("wcv:destroy", id) as Promise<void>;
    },
    setBounds: (id: number, bounds: unknown) => {
      return ipcRenderer.invoke("wcv:setBounds", id, bounds) as Promise<void>;
    },
    setVisible: (id: number, visible: boolean) => {
      return ipcRenderer.invoke("wcv:setVisible", id, visible) as Promise<void>;
    },
    loadURL: (id: number, url: string) => {
      return ipcRenderer.invoke("wcv:loadURL", id, url) as Promise<void>;
    },
    reload: (id: number) => {
      return ipcRenderer.invoke("wcv:reload", id) as Promise<void>;
    },
    goBack: (id: number) => {
      return ipcRenderer.invoke("wcv:goBack", id) as Promise<void>;
    },
    goForward: (id: number) => {
      return ipcRenderer.invoke("wcv:goForward", id) as Promise<void>;
    },
    executeJavaScript: (id: number, code: string) => {
      return ipcRenderer.invoke("wcv:executeJavaScript", id, code) as Promise<unknown>;
    },
    insertCSS: (id: number, css: string) => {
      return ipcRenderer.invoke("wcv:insertCSS", id, css) as Promise<void>;
    },
    focus: (id: number) => {
      return ipcRenderer.invoke("wcv:focus", id) as Promise<void>;
    },
    blur: (id: number) => {
      return ipcRenderer.invoke("wcv:blur", id) as Promise<void>;
    },
    canGoBack: (id: number) => {
      return ipcRenderer.invoke("wcv:canGoBack", id) as Promise<boolean>;
    },
    canGoForward: (id: number) => {
      return ipcRenderer.invoke("wcv:canGoForward", id) as Promise<boolean>;
    },
    getURL: (id: number) => {
      return ipcRenderer.invoke("wcv:getURL", id) as Promise<string>;
    },
    getTitle: (id: number) => {
      return ipcRenderer.invoke("wcv:getTitle", id) as Promise<string>;
    },
    isLoading: (id: number) => {
      return ipcRenderer.invoke("wcv:isLoading", id) as Promise<boolean>;
    },
    stop: (id: number) => {
      return ipcRenderer.invoke("wcv:stop", id) as Promise<void>;
    },
    openDevTools: (id: number) => {
      return ipcRenderer.invoke("wcv:openDevTools", id) as Promise<void>;
    },
    closeDevTools: (id: number) => {
      return ipcRenderer.invoke("wcv:closeDevTools", id) as Promise<void>;
    },
  },
};

contextBridge.exposeInMainWorld("electron", electronAPI);
contextBridge.exposeInMainWorld("api", api);
contextBridge.exposeInMainWorld("cmux", cmuxAPI);

// Mirror main process logs into the renderer console so they show up in
// DevTools. Avoid exposing tokens or sensitive data in main logs.
ipcRenderer.on(
  "main-log",
  (_event, payload: { level: "log" | "warn" | "error"; message: string }) => {
    const level = payload?.level ?? "log";
    const msg = payload?.message ?? "";
    const fn = console[level] ?? console.log;
    try {
      fn(msg);
    } catch {
      // fallback
      console.log(msg);
    }
  }
);
