import type {
  ClientToServerEvents,
  ServerToClientEvents,
  AvailableEditors,
} from "@cmux/shared";
import React, { useEffect, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import { SocketContext } from "./socket-context";

export interface SocketContextType {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
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
  const [socket, setSocket] = React.useState<
    SocketContextType["socket"] | null
  >(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const [availableEditors, setAvailableEditors] = React.useState<
    AvailableEditors | null
  >(null);

  useEffect(() => {
    const newSocket = io(url, {
      transports: ["websocket"],
    });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Socket connected");
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    });

    newSocket.on("available-editors", (data) => {
      setAvailableEditors(data);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [url]);

  const contextValue: SocketContextType = useMemo(
    () => ({
      socket,
      isConnected,
      availableEditors,
    }),
    [socket, isConnected, availableEditors]
  );

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};
