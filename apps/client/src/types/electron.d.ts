import type {
  ElectronLogsPayload,
  ElectronMainLogMessage,
} from "../lib/electron-logs/types";

interface CmuxSocketAPI {
  connect: (query: Record<string, string>) => Promise<{ socketId: string; connected: boolean }>;
  disconnect: (socketId: string) => Promise<{ disconnected: boolean }>;
  emit: (socketId: string, eventName: string, ...args: unknown[]) => Promise<{ success: boolean }>;
  on: (socketId: string, eventName: string) => Promise<{ success: boolean }>;
  onEvent: (socketId: string, callback: (eventName: string, ...args: unknown[]) => void) => void;
}

interface CmuxLogsAPI {
  onMainLog: (
    callback: (entry: ElectronMainLogMessage) => void
  ) => () => void;
  readAll: () => Promise<ElectronLogsPayload>;
  copyAll: () => Promise<{ ok: boolean }>;
}

interface CmuxAPI {
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
  socket: CmuxSocketAPI;
  logs: CmuxLogsAPI;
}

declare global {
  interface Window {
    cmux: CmuxAPI;
  }
}

export {};
