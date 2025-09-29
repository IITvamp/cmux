import type { AvailableEditors } from "@cmux/shared";
import {
  connectToMainServer,
  type MainServerSocket,
} from "@cmux/shared/socket";
import { useLocation } from "@tanstack/react-router";
import React, { useEffect, useMemo } from "react";
import { useUser } from "@stackframe/react";
import { setGlobalSocket, socketBoot } from "./socket-boot";
import { WebSocketContext } from "./socket-context";

export interface SocketContextType {
  socket: MainServerSocket | null;
  isConnected: boolean;
  availableEditors: AvailableEditors | null;
}

interface SocketProviderProps {
  children: React.ReactNode;
  url?: string;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({
  children,
  url = "http://localhost:9776",
}) => {
  const user = useUser({ or: "return-null" });
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
    if (!user) {
      console.warn("[Socket] No user yet; delaying socket connect");
      setSocket(null);
      setIsConnected(false);
      setAvailableEditors(null);
      setGlobalSocket(null);
      socketBoot.reset();
      return;
    }
    let disposed = false;
    let createdSocket: MainServerSocket | null = null;
    (async () => {
      try {
        const authJson = await user.getAuthJson();
        const authToken = authJson?.accessToken ?? null;
        if (!authToken) {
          console.warn("[Socket] Missing access token; skipping connect");
          return;
        }

        const newSocket = connectToMainServer({
          url,
          authToken,
          teamSlugOrId,
          authJson: authJson ?? undefined,
        });

        createdSocket = newSocket;
        if (disposed) {
          newSocket.disconnect();
          return;
        }
        setSocket(newSocket);
        setGlobalSocket(newSocket);
        // Signal that the provider has created the socket instance
        socketBoot.resolve();

        newSocket.on("connect", () => {
          console.log("[Socket] connected");
          setIsConnected(true);
        });

        newSocket.on("disconnect", () => {
          console.warn("[Socket] disconnected");
          setIsConnected(false);
        });

        newSocket.on("connect_error", (err) => {
          const errorMessage =
            err && typeof err === "object" && "message" in err
              ? (err as Error).message
              : String(err);
          console.error("[Socket] connect_error", errorMessage);
        });

        newSocket.on("available-editors", (data: AvailableEditors) => {
          setAvailableEditors(data);
        });
      } catch (error) {
        console.error("[Socket] Failed to initialize socket", error);
      }
    })();

    return () => {
      disposed = true;
      if (createdSocket) createdSocket.disconnect();
      // Reset boot handle so future mounts can suspend appropriately
      setGlobalSocket(null);
      socketBoot.reset();
    };
  }, [url, teamSlugOrId, user, user?.id]);

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
