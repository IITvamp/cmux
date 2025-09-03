import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

const api = {};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("api", api);
    // Mirror main process logs into the renderer console so they show up in
    // DevTools. Avoid exposing tokens or sensitive data in main logs.
    ipcRenderer.on(
      "main-log",
      (
        _event,
        payload: { level: "log" | "warn" | "error"; message: string }
      ) => {
        const level = payload?.level ?? "log";
        const msg = payload?.message ?? "";
        const fn = (console as any)[level] ?? console.log;
        try {
          fn(msg);
        } catch {
          // fallback
          console.log(msg);
        }
      }
    );
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-expect-error - window augmentation for non-isolated context
  window.electron = electronAPI;
  // @ts-expect-error - window augmentation for non-isolated context
  window.api = api;
  ipcRenderer.on(
    "main-log",
    (_event, payload: { level: "log" | "warn" | "error"; message: string }) => {
      const level = payload?.level ?? "log";
      const msg = payload?.message ?? "";
      const fn = (console as any)[level] ?? console.log;
      try {
        fn(msg);
      } catch {
        console.log(msg);
      }
    }
  );
}
