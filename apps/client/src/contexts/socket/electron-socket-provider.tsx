import React from "react";
import { SocketProvider } from "./socket-provider";

// ElectronSocketProvider connects to the local server running on port 9776
// The server should be started separately (not inside the Electron app)
export const ElectronSocketProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  // Connect to localhost server - the server runs separately from Electron
  // This avoids bundling server dependencies with the Electron app
  return <SocketProvider url="http://localhost:9776">{children}</SocketProvider>;
};