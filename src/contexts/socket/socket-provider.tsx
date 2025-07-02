import React, { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { SocketContext } from "./socket-context";

export interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

interface SocketProviderProps {
  children: React.ReactNode;
  url?: string;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({
  children,
  url = "http://localhost:3001",
}) => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);

  useEffect(() => {
    socketRef.current = io(url, { transports: ["websocket"] });

    socketRef.current.on("connect", () => {
      console.log("Socket connected");
      setIsConnected(true);
    });

    socketRef.current.on("disconnect", () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [url]);

  const contextValue: SocketContextType = {
    socket: socketRef.current,
    isConnected,
  };

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};
