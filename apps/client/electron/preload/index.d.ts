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
      wcv: {
        create: () => Promise<{ id: number }>;
        destroy: (id: number) => Promise<{ ok: boolean }>;
        attach: (id: number) => Promise<{ ok: boolean }>;
        detach: (id: number) => Promise<{ ok: boolean }>;
        setBounds: (
          id: number,
          bounds: { x: number; y: number; width: number; height: number }
        ) => Promise<{ ok: boolean }>;
        loadURL: (id: number, url: string) => Promise<{ ok: boolean }>;
        reload: (id: number) => Promise<{ ok: boolean }>;
        goBack: (id: number) => Promise<{ ok: boolean }>;
        goForward: (id: number) => Promise<{ ok: boolean }>;
        openDevTools: (id: number) => Promise<{ ok: boolean }>;
        closeDevTools: (id: number) => Promise<{ ok: boolean }>;
        focus: (id: number) => Promise<{ ok: boolean }>;
        onEvent: (id: number, cb: (payload: unknown) => void) => () => void;
      };
    };
  }
}
