import React from "react";
import { SocketProvider } from "./socket-provider";

interface RealSocketProviderProps {
  children: React.ReactNode;
}

export const RealSocketProvider: React.FC<RealSocketProviderProps> = ({
  children,
}) => {
  // Electron currently uses the same HTTP socket client as web.
  return <SocketProvider>{children}</SocketProvider>;
};
