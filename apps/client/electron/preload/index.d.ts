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
