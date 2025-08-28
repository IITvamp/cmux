import { ElectronAPI } from "@electron-toolkit/preload";

interface OAuthCallbackData {
  refreshToken: string;
  state?: string;
}

interface Api {
  onOAuthCallback: (callback: (data: OAuthCallbackData) => void) => void;
  removeOAuthCallbackListener: () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: Api;
  }
}
