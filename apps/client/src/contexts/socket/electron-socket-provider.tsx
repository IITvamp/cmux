import { CmuxIpcSocketClient } from "@/lib/cmux-ipc-socket-client";
import { type MainServerSocket } from "@cmux/shared/socket";
import { useLocation } from "@tanstack/react-router";
import React, { useEffect, useMemo } from "react";
import { useUser } from "@stackframe/react";
import { setGlobalSocket, socketBoot } from "./socket-boot";
import { ElectronSocketContext } from "./socket-context";
import type { SocketContextType } from "./types";

export const ElectronSocketProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const user = useUser({ or: "return-null" });
  const location = useLocation();
  const [socket, setSocket] = React.useState<
    SocketContextType["socket"] | null
  >(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const [availableEditors, setAvailableEditors] =
    React.useState<SocketContextType["availableEditors"]>(null);
  const teamSlugOrId = React.useMemo(() => {
    const pathname = location.pathname || "";
    const seg = pathname.split("/").filter(Boolean)[0];
    if (!seg || seg === "team-picker") return undefined;
    return seg;
  }, [location.pathname]);

  useEffect(() => {
    if (!user) {
      console.warn("[ElectronSocket] No user yet; delaying connect");
      setSocket(null);
      setIsConnected(false);
      setAvailableEditors(null);
      setGlobalSocket(null);
      socketBoot.reset();
      return;
    }

    let disposed = false;
    let createdSocket: CmuxIpcSocketClient | null = null;

    (async () => {
      try {
        const authJson = await user.getAuthJson();
        const authToken = authJson?.accessToken ?? null;
        if (!authToken) {
          console.warn("[ElectronSocket] Missing access token; skipping connect");
          return;
        }

        const query: Record<string, string> = { auth: authToken };
        if (teamSlugOrId) {
          query.team = teamSlugOrId;
        }
        if (authJson) {
          query.auth_json = JSON.stringify(authJson);
        }

        if (disposed) return;

        console.log("[ElectronSocket] Connecting via IPC (cmux)...");
        createdSocket = new CmuxIpcSocketClient(query);

        createdSocket.on("connect", () => {
          if (disposed) return;
          setIsConnected(true);
        });

        createdSocket.on("disconnect", () => {
          if (disposed) return;
          console.log("[ElectronSocket] Disconnected from IPC");
          setIsConnected(false);
        });

        createdSocket.on("connect_error", (error: unknown) => {
          console.error("[ElectronSocket] Connection error:", error);
        });

        createdSocket.on("available-editors", (editors: unknown) => {
          if (disposed) return;
          console.log("[ElectronSocket] Available editors:", editors);
          setAvailableEditors(editors as SocketContextType["availableEditors"]);
        });

        // Connect the socket
        createdSocket.connect();

        if (!disposed) {
          // Cast to Socket type to satisfy type requirement
          setSocket(createdSocket as unknown as MainServerSocket);
          setGlobalSocket(createdSocket as unknown as MainServerSocket);
          // Signal that the provider has created the socket instance
          socketBoot.resolve();
        }
      } catch (error) {
        console.error("[ElectronSocket] Failed to initialize socket", error);
      }
    })();

    return () => {
      disposed = true;
      if (createdSocket) {
        console.log("[ElectronSocket] Cleaning up IPC socket");
        createdSocket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      // Reset boot handle so future mounts can suspend appropriately
      setGlobalSocket(null);
      socketBoot.reset();
    };
  }, [user, user?.id, teamSlugOrId]);

  const contextValue = useMemo<SocketContextType>(
    () => ({
      socket,
      isConnected,
      availableEditors,
    }),
    [socket, isConnected, availableEditors]
  );

  return (
    <ElectronSocketContext.Provider value={contextValue}>
      {children}
    </ElectronSocketContext.Provider>
  );
};
