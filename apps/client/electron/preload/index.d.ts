import { ElectronAPI } from "@electron-toolkit/preload";

declare global {
  interface Window {
    electron: ElectronAPI;
    api: {
      onAuthCallback: (callback: (data: { refreshToken: string }) => void) => void;
      removeAuthCallbackListener: () => void;
    };
  }
}