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

interface CmuxRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CmuxWebContentsViewAPI {
  create: (options: {
    url: string;
    bounds?: CmuxRectangle;
    backgroundColor?: string;
    borderRadius?: number;
    persistKey?: string;
  }) => Promise<
    {
      id: number;
      webContentsId: number;
      restored: boolean;
      url?: string;
      title?: string;
      isLoading?: boolean;
    }
  >;
  setBounds: (options: { id: number; bounds: CmuxRectangle; visible?: boolean }) => Promise<
    { ok: boolean }
  >;
  loadURL: (id: number, url: string) => Promise<{ ok: boolean }>;
  release: (options: { id: number; persist?: boolean }) => Promise<
    { ok: boolean; suspended: boolean }
  >;
  destroy: (id: number) => Promise<{ ok: boolean }>;
  updateStyle: (options: {
    id: number;
    backgroundColor?: string;
    borderRadius?: number;
  }) => Promise<{ ok: boolean }>;
  getState: (options: { id?: number; persistKey?: string }) => Promise<
    {
      ok: boolean;
      state?: {
        url: string | null;
        title: string | null;
        isLoading: boolean;
        canGoBack: boolean;
        canGoForward: boolean;
      };
      error?: string;
    }
  >;
  onEvent: (
    listener: (event: CmuxWebContentsViewEvent) => void
  ) => () => void;
  openDevTools: (options: {
    id?: number;
    persistKey?: string;
    mode?: "right" | "bottom" | "left" | "detach" | "undocked";
  }) => Promise<{ ok: boolean; error?: string }>;
}

type CmuxWebContentsViewEvent =
  | ({
      type: "did-attach";
      url?: string | null;
      title?: string | null;
      isLoading?: boolean;
      canGoBack?: boolean;
      canGoForward?: boolean;
    } & CmuxWebContentsViewBaseEvent)
  | ({
      type: "did-start-loading" | "did-stop-loading" | "did-finish-load";
      url?: string | null;
      isLoading?: boolean;
      canGoBack?: boolean;
      canGoForward?: boolean;
    } & CmuxWebContentsViewBaseEvent)
  | ({
      type: "did-navigate";
      url: string;
      title?: string | null;
      httpResponseCode?: number;
      httpStatusText?: string;
      canGoBack?: boolean;
      canGoForward?: boolean;
    } & CmuxWebContentsViewBaseEvent)
  | ({
      type: "did-navigate-in-page";
      url: string;
      isMainFrame?: boolean;
      canGoBack?: boolean;
      canGoForward?: boolean;
    } & CmuxWebContentsViewBaseEvent)
  | ({
      type: "did-fail-load";
      errorCode?: number;
      errorDescription?: string;
      validatedURL?: string;
      isMainFrame?: boolean;
    } & CmuxWebContentsViewBaseEvent)
  | ({
      type: "page-title-updated";
      title: string;
      url?: string | null;
    } & CmuxWebContentsViewBaseEvent);

interface CmuxWebContentsViewBaseEvent {
  id: number;
  persistKey?: string;
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
  webContentsView: CmuxWebContentsViewAPI;
}

declare global {
  interface Window {
    cmux: CmuxAPI;
  }
}

export {};
