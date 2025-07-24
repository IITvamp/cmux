import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@coderouter/shared";
import React, { useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { SocketContext } from "./socket-context";

export interface SocketContextType {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  isConnected: boolean;
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

  useEffect(() => {
    const newSocket = io(url, { transports: ["websocket"] });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Socket connected");
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [url]);

  const contextValue: SocketContextType = {
    socket,
    isConnected,
  };

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};
