import React from "react";
import { isElectron } from "@/lib/electron";
import { SocketProvider } from "./socket-provider";
import { ElectronSocketProvider } from "./electron-socket-provider";

interface RealSocketProviderProps {
  children: React.ReactNode;
}

export const RealSocketProvider: React.FC<RealSocketProviderProps> = ({
  children,
}) => {
  return isElectron ? (
    <ElectronSocketProvider>{children}</ElectronSocketProvider>
  ) : (
    <SocketProvider>{children}</SocketProvider>
  );
};
