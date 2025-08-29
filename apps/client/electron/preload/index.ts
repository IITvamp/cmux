import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

const api = {};

// Mirror main-process logs into the renderer DevTools console
try {
  ipcRenderer.on("main-log", (_event, payload) => {
    const { level, args } = (payload || {}) as {
      level: "info" | "warn" | "error" | "debug";
      args: unknown[];
    };
    const prefix = "[main]";
    if (level === "error") {
      // eslint-disable-next-line no-console
      console.error(prefix, ...(args || []));
    } else if (level === "warn") {
      // eslint-disable-next-line no-console
      console.warn(prefix, ...(args || []));
    } else if (level === "debug") {
      // eslint-disable-next-line no-console
      console.debug(prefix, ...(args || []));
    } else {
      // eslint-disable-next-line no-console
      console.log(prefix, ...(args || []));
    }
  });
} catch (err) {
  // eslint-disable-next-line no-console
  console.error("Failed to attach main-log mirror", err);
}
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-expect-error - window augmentation for non-isolated context
  window.electron = electronAPI;
  // @ts-expect-error - window augmentation for non-isolated context
  window.api = api;
}
