export type ElectronDevToolsMode = "right" | "bottom" | "undocked" | "detach";

export interface ElectronWebContentsState {
  id: number;
  webContentsId: number;
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
  isDevToolsOpened: boolean;
}

export interface ElectronWebContentsSnapshot {
  id: number;
  ownerWindowId: number;
  ownerWebContentsId: number;
  persistKey?: string;
  suspended: boolean;
  ownerWebContentsDestroyed: boolean;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  visible: boolean | null;
  state: ElectronWebContentsState | null;
}

export interface ElectronWebContentsStateEvent {
  type: "state";
  state: ElectronWebContentsState;
  reason?: string;
}

export interface ElectronWebContentsLoadFailedEvent {
  type: "load-failed";
  id: number;
  errorCode: number;
  errorDescription: string;
  validatedURL: string;
  isMainFrame: boolean;
}

export interface ElectronWebContentsDidStartNavigationEvent {
  type: "did-start-navigation";
  url: string;
  isMainFrame: boolean;
  isInPlace: boolean;
  frameProcessId: number;
  frameRoutingId: number;
}

export type ElectronWebContentsEvent =
  | ElectronWebContentsStateEvent
  | ElectronWebContentsLoadFailedEvent
  | ElectronWebContentsDidStartNavigationEvent;
