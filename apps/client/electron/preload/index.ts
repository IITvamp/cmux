import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

const api = {
  onOAuthCallback: (
    callback: (data: { refreshToken: string; state?: string }) => void,
  ) => {
    ipcRenderer.on("oauth-callback", (_, data) => callback(data));
  },
  removeOAuthCallbackListener: () => {
    ipcRenderer.removeAllListeners("oauth-callback");
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
