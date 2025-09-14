import { ElectronAPI } from "@electron-toolkit/preload";

declare global {
  interface Window {
    electron: ElectronAPI;
    api: unknown;
    cmux: {
      register: (meta: { auth?: string; team?: string; auth_json?: string }) => Promise<unknown>;
      rpc: (event: string, ...args: unknown[]) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => () => void;
      off: (event: string, callback?: (...args: unknown[]) => void) => void;
      ui: {
        focusWebContents: (id: number) => Promise<{ ok: boolean }>;
        restoreLastFocusInWebContents: (id: number) => Promise<{ ok: boolean }>;
        restoreLastFocusInFrame: (
          contentsId: number,
          frameRoutingId: number,
          frameProcessId: number
        ) => Promise<{ ok: boolean }>;
        setCommandPaletteOpen: (open: boolean) => Promise<{ ok: boolean }>;
        restoreLastFocus: () => Promise<{ ok: boolean }>;
      };
      webContentsView: {
        create: (options: unknown) => Promise<number>;
        destroy: (id: number) => Promise<void>;
        setBounds: (id: number, bounds: unknown) => Promise<void>;
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
      };
      socket: {
        connect: (query: Record<string, string>) => Promise<unknown>;
        disconnect: (socketId: string) => Promise<unknown>;
        emit: (socketId: string, eventName: string, ...args: unknown[]) => Promise<unknown>;
        on: (socketId: string, eventName: string) => Promise<unknown>;
        onEvent: (
          socketId: string,
          callback: (eventName: string, ...args: unknown[]) => void
        ) => void;
      };
    };
  }
}
