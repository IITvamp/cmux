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
  // WebContentsView controls
  wcv: {
    create: () => ipcRenderer.invoke("wcv:create") as Promise<{ id: number }>,
    destroy: (id: number) => ipcRenderer.invoke("wcv:destroy", id) as Promise<{ ok: boolean }>,
    attach: (id: number) => ipcRenderer.invoke("wcv:attach", id) as Promise<{ ok: boolean }>,
    detach: (id: number) => ipcRenderer.invoke("wcv:detach", id) as Promise<{ ok: boolean }>,
    setBounds: (id: number, bounds: { x: number; y: number; width: number; height: number }) =>
      ipcRenderer.invoke("wcv:set-bounds", id, bounds) as Promise<{ ok: boolean }>,
    loadURL: (id: number, url: string) => ipcRenderer.invoke("wcv:load-url", id, url) as Promise<{ ok: boolean }>,
    reload: (id: number) => ipcRenderer.invoke("wcv:reload", id) as Promise<{ ok: boolean }>,
    goBack: (id: number) => ipcRenderer.invoke("wcv:go-back", id) as Promise<{ ok: boolean }>,
    goForward: (id: number) => ipcRenderer.invoke("wcv:go-forward", id) as Promise<{ ok: boolean }>,
    openDevTools: (id: number) => ipcRenderer.invoke("wcv:open-devtools", id) as Promise<{ ok: boolean }>,
    closeDevTools: (id: number) => ipcRenderer.invoke("wcv:close-devtools", id) as Promise<{ ok: boolean }>,
    focus: (id: number) => ipcRenderer.invoke("wcv:focus", id) as Promise<{ ok: boolean }>,
    onEvent: (id: number, cb: (payload: unknown) => void) => {
      const ch = `wcv:event:${id}`;
      const listener = (_e: Electron.IpcRendererEvent, payload: unknown) => cb(payload);
      ipcRenderer.on(ch, listener);
      return () => ipcRenderer.removeListener(ch, listener);
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
