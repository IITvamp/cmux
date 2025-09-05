import type {
  ClientToServerEvents,
  ServerToClientEvents,
  AvailableEditors,
} from "@cmux/shared";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import React, { useEffect, useState, useMemo } from "react";
import type { Socket } from "socket.io-client";
import { authJsonQueryOptions } from "../convex/authJsonQueryOptions";
import { SocketContext } from "./socket-context";

type IpcRendererLike = {
  on: (
    channel: string,
    listener: (event: unknown, ...args: unknown[]) => void
  ) => void;
  once: (
    channel: string,
    listener: (event: unknown, ...args: unknown[]) => void
  ) => void;
  removeAllListeners?: (channel: string) => void;
};

type MessageEventLike = { data?: unknown; ports?: MessagePort[] };

function isFunction(x: unknown): x is (...args: unknown[]) => void {
  return typeof x === "function";
}

// Minimal Socket.IO-like client over a MessagePort
class ElectronSocketClient {
  private port: MessagePort | null = null;
  private connected = false;
  private readonly handlers = new Map<string, Set<(...args: unknown[]) => void>>();
  private readonly ackMap = new Map<string, (data: unknown) => void>();
  private readonly onMessage = (ev: MessageEvent) => {
    const payload = (ev as unknown as MessageEventLike)?.data as
      | { kind: string; [k: string]: unknown }
      | undefined;
    if (!payload || typeof payload !== "object") return;

    switch (payload.kind) {
      case "server-event": {
        const event = String((payload as unknown as { event?: unknown }).event ?? "");
        const data = (payload as unknown as { data?: unknown }).data;
        const hs = this.handlers.get(event);
        if (hs) {
          for (const h of hs) {
            try {
              h(data as never);
            } catch {
              // ignore handler errors
            }
          }
        }
        break;
      }
      case "ack": {
        const id = String((payload as unknown as { ackId?: unknown }).ackId ?? "");
        const fn = this.ackMap.get(id);
        if (fn) {
          this.ackMap.delete(id);
          try {
            fn((payload as unknown as { data?: unknown }).data);
          } catch {
            // ignore
          }
        }
        break;
      }
      case "server-disconnect": {
        this.emitLocal("disconnect");
        this.connected = false;
        break;
      }
    }
  };

  private emitLocal(event: string, data?: unknown): void {
    const hs = this.handlers.get(event);
    if (hs) {
      for (const h of hs) {
        try {
          if (typeof data === "undefined") h();
          else h(data);
        } catch {
          // ignore
        }
      }
    }
  }

  attachPort(port: MessagePort): void {
    this.port = port;
    try {
      this.port.start();
    } catch {
      // some environments auto-start
    }
    this.port.addEventListener("message", this.onMessage);
  }

  handshake(query: Record<string, string>): void {
    if (!this.port) return;
    this.port.postMessage({ kind: "handshake", query });
    // consider connected once handshake is sent
    this.connected = true;
    this.emitLocal("connect");
  }

  on(event: string, handler: (...args: unknown[]) => void): void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: (...args: unknown[]) => void): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event: string, ...args: unknown[]): void {
    if (!this.port) return;
    let data: unknown | undefined;
    let ack: ((data: unknown) => void) | undefined;
    if (args.length === 1 && isFunction(args[0])) {
      ack = args[0] as (d: unknown) => void;
    } else if (args.length >= 1) {
      data = args[0];
      const last = args[args.length - 1];
      if (isFunction(last)) ack = last as (d: unknown) => void;
    }
    const ackId = ack ? `${Date.now()}_${Math.random().toString(36).slice(2)}` : undefined;
    if (ack && ackId) this.ackMap.set(ackId, ack);
    this.port.postMessage({ kind: "event", event, data, ackId });
  }

  disconnect(): void {
    try {
      this.port?.postMessage({ kind: "disconnect" });
    } catch {
      // ignore
    }
    try {
      this.port?.removeEventListener("message", this.onMessage);
    } catch {
      // ignore
    }
    try {
      this.port?.close();
    } catch {
      // ignore
    }
    this.connected = false;
    this.emitLocal("disconnect");
  }

  isConnected(): boolean {
    return this.connected;
  }
}

export const ElectronSocketProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const authJsonQuery = useQuery(authJsonQueryOptions());
  const authToken = authJsonQuery.data?.accessToken;
  const location = useLocation();
  const [connected, setConnected] = useState(false);
  const [availableEditors, setAvailableEditors] =
    useState<AvailableEditors | null>(null);
  const [socket, setSocket] = useState<
    Socket<ServerToClientEvents, ClientToServerEvents> | null
  >(null);

  // Derive teamSlugOrId like the standard provider
  const teamSlugOrId = useMemo(() => {
    const pathname = location.pathname || "";
    const seg = pathname.split("/").filter(Boolean)[0];
    if (!seg || seg === "team-picker") return undefined;
    return seg;
  }, [location.pathname]);

  useEffect(() => {
    const w = window as unknown as {
      electron?: { ipcRenderer?: IpcRendererLike };
    };
    const ipc = w.electron?.ipcRenderer;

    if (!authToken) return;

    const client = new ElectronSocketClient();

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    const handleAvailableEditors = (data: unknown) => {
      setAvailableEditors((data ?? null) as AvailableEditors | null);
    };
    client.on("connect", handleConnect);
    client.on("disconnect", handleDisconnect);
    client.on("available-editors", handleAvailableEditors);

    const token = authToken as string;
    function handshakeIfReady(port: MessagePort) {
      client.attachPort(port);
      const query: Record<string, string> = { auth: token };
      if (teamSlugOrId) query.team = teamSlugOrId;
      client.handshake(query);
      // Expose as Socket-typed instance for consumers
      setSocket(client as unknown as Socket<ServerToClientEvents, ClientToServerEvents>);
    }

    // Receive MessagePort via Electron ipcRenderer (optional) and always via DOM postMessage
    let removeDomListener: (() => void) | null = null;

    if (ipc?.once) {
      try {
        ipc.once("cmux:port", (event: unknown) => {
          const e = event as { ports?: MessagePort[] };
          const port = e?.ports?.[0];
          if (port) handshakeIfReady(port);
        });
      } catch {
        // ignore ipc registration failure
      }
    }

    const onWindowMessage = (ev: MessageEvent) => {
      const data = (ev as unknown as MessageEventLike).data as
        | { channel?: string }
        | string
        | undefined;
      const ports = (ev as unknown as MessageEventLike).ports;
      const isMatch =
        (typeof data === "string" && data === "cmux:port") ||
        (typeof data === "object" && data && data.channel === "cmux:port");
      if (isMatch && ports && ports[0]) {
        handshakeIfReady(ports[0]);
      }
    };
    window.addEventListener("message", onWindowMessage as EventListener);
    removeDomListener = () =>
      window.removeEventListener("message", onWindowMessage as EventListener);

    return () => {
      try {
        client.disconnect();
      } catch {
        // ignore
      }
      if (removeDomListener) {
        try {
          removeDomListener();
        } catch {
          // ignore
        }
      }
      try {
        ipc?.removeAllListeners?.("cmux:port");
      } catch {
        // ignore
      }
    };
  }, [authToken, teamSlugOrId]);

  const contextValue = useMemo(
    () => ({ socket, isConnected: connected, availableEditors }),
    [socket, connected, availableEditors]
  );

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};
