import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import React, { useEffect, useMemo } from "react";
import { io } from "socket.io-client";
import { authJsonQueryOptions } from "../convex/authJsonQueryOptions";
import { WebSocketContext } from "./socket-context";
import type { SocketContextType } from "./types";

interface SocketProviderProps {
  children: React.ReactNode;
  url?: string;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({
  children,
  url = "http://localhost:9776",
}) => {
  const authJsonQuery = useQuery(authJsonQueryOptions());
  const authToken = authJsonQuery.data?.accessToken;
  const location = useLocation();
  const [socket, setSocket] = React.useState<
    SocketContextType["socket"] | null
  >(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const [availableEditors, setAvailableEditors] =
    React.useState<SocketContextType["availableEditors"]>(null);

  // Derive the current teamSlugOrId from the first URL segment, ignoring the team-picker route
  const teamSlugOrId = React.useMemo(() => {
    const pathname = location.pathname || "";
    const seg = pathname.split("/").filter(Boolean)[0];
    if (!seg || seg === "team-picker") return undefined;
    return seg;
  }, [location.pathname]);

  useEffect(() => {
    if (!authToken) {
      console.warn("[Socket] No auth token yet; delaying connect");
      return;
    }
    const query: Record<string, string> = { auth: authToken };
    if (teamSlugOrId) {
      query.team = teamSlugOrId;
    }

    const newSocket = io(url, {
      transports: ["websocket"],
      query,
    });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("[Socket] connected", { url, team: teamSlugOrId });
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.warn("[Socket] disconnected");
      setIsConnected(false);
    });

    newSocket.on("connect_error", (err) => {
      console.error("[Socket] connect_error", err?.message ?? err);
    });

    newSocket.on("available-editors", (data) => {
      setAvailableEditors(data);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [url, authToken, teamSlugOrId]);

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
