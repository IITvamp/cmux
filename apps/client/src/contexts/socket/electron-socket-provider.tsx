import React, { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { authJsonQueryOptions } from "../convex/authJsonQueryOptions";
import { cachedGetUser } from "../../lib/cachedGetUser";
import { stackClientApp } from "../../lib/stack";
import { WebSocketContext } from "./socket-context";
import type { SocketContextType } from "./types";
import { IPCSocketClient } from "../../lib/ipc-socket-client";

// ElectronSocketProvider uses IPC to communicate with embedded server
export const ElectronSocketProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const authJsonQuery = useQuery(authJsonQueryOptions());
  const authToken = authJsonQuery.data?.accessToken;
  const location = useLocation();
  const [socket, setSocket] = React.useState<SocketContextType["socket"] | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const [availableEditors, setAvailableEditors] =
    React.useState<SocketContextType["availableEditors"]>(null);

  // Derive the current teamSlugOrId from the first URL segment
  const teamSlugOrId = React.useMemo(() => {
    const pathname = location.pathname || "";
    const seg = pathname.split("/").filter(Boolean)[0];
    if (!seg || seg === "team-picker") return undefined;
    return seg;
  }, [location.pathname]);

  useEffect(() => {
    if (!authToken) {
      console.warn("[ElectronSocket] No auth token yet; delaying connect");
      return;
    }

    let disposed = false;
    let createdSocket: IPCSocketClient | null = null;

    (async () => {
      // Fetch full auth JSON for server
      const user = await cachedGetUser(stackClientApp);
      const authJson = user ? await user.getAuthJson() : undefined;

      const query: Record<string, string> = { auth: authToken };
      if (teamSlugOrId) {
        query.team = teamSlugOrId;
      }
      if (authJson) {
        query.auth_json = JSON.stringify(authJson);
      }

      console.log("[ElectronSocket] Creating IPC socket connection");
      const newSocket = new IPCSocketClient(query);
      
      createdSocket = newSocket;
      if (disposed) {
        newSocket.disconnect();
        return;
      }
      
      newSocket.connect();
      setSocket(newSocket as any);

      newSocket.on("connect", () => {
        console.log("[ElectronSocket] connected via IPC");
        setIsConnected(true);
      });

      newSocket.on("disconnect", () => {
        console.warn("[ElectronSocket] disconnected");
        setIsConnected(false);
      });

      newSocket.on("connect_error", (err: any) => {
        console.error("[ElectronSocket] connect_error", err);
      });

      newSocket.on("available-editors", (data: any) => {
        setAvailableEditors(data as SocketContextType["availableEditors"]);
      });
    })();

    return () => {
      disposed = true;
      if (createdSocket) createdSocket.disconnect();
    };
  }, [authToken, teamSlugOrId]);

  const contextValue: SocketContextType = useMemo(
    () => ({
      socket,
      isConnected,
      availableEditors,
    }),
    [socket, isConnected, availableEditors]
  );

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};