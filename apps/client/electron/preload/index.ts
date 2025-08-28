import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

const api = {
  onAuthCallback: (callback: (data: { refreshToken: string }) => void) => {
    ipcRenderer.on("auth-callback", (_event, data) => callback(data));
  },
  removeAuthCallbackListener: () => {
    ipcRenderer.removeAllListeners("auth-callback");
  },
};

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