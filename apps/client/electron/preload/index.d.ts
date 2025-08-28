import { ElectronAPI } from "@electron-toolkit/preload";

interface AuthCallbackAPI {
  onAuthCallback: (callback: (data: { refreshToken: string }) => void) => void;
  removeAuthCallback: () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: AuthCallbackAPI;
  }
}
