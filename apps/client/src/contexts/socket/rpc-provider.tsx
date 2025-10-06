import type { AvailableEditors } from "@cmux/shared";
import {
  connectToMainServerRpc,
  type MainServerRpcStub,
} from "@cmux/shared";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import React, { useEffect, useMemo } from "react";
import { cachedGetUser } from "../../lib/cachedGetUser";
import { stackClientApp } from "../../lib/stack";
import { authJsonQueryOptions } from "../convex/authJsonQueryOptions";
import { setGlobalRpcStub, rpcBoot } from "./rpc-boot";
import { RpcContext } from "./rpc-context";
import { env } from "@/client-env";

export interface RpcContextType {
  rpcStub: MainServerRpcStub | null;
  isConnected: boolean;
  availableEditors: AvailableEditors | null;
}

interface RpcProviderProps {
  children: React.ReactNode;
  url?: string;
}

export const RpcProvider: React.FC<RpcProviderProps> = ({
  children,
  url = env.NEXT_PUBLIC_SERVER_ORIGIN || "http://localhost:9776",
}) => {
  const authJsonQuery = useQuery(authJsonQueryOptions());
  const authToken = authJsonQuery.data?.accessToken;
  const location = useLocation();
  const [rpcStub, setRpcStub] = React.useState<
    RpcContextType["rpcStub"] | null
  >(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const [availableEditors, setAvailableEditors] =
    React.useState<RpcContextType["availableEditors"]>(null);

  // Derive the current teamSlugOrId from the first URL segment, ignoring the team-picker route
  const teamSlugOrId = React.useMemo(() => {
    const pathname = location.pathname || "";
    const seg = pathname.split("/").filter(Boolean)[0];
    if (!seg || seg === "team-picker") return undefined;
    return seg;
  }, [location.pathname]);

  useEffect(() => {
    if (!authToken) {
      console.warn("[RPC] No auth token yet; delaying connect");
      return;
    }
    let disposed = false;
    (async () => {
      // Fetch full auth JSON for server to forward as x-stack-auth
      const user = await cachedGetUser(stackClientApp);
      const authJson = user ? await user.getAuthJson() : undefined;

      const stub = connectToMainServerRpc({
        url,
        authToken,
        teamSlugOrId,
        authJson,
      });

      if (disposed) {
        return;
      }
      setRpcStub(stub);
      setGlobalRpcStub(stub);
      setIsConnected(true);
      rpcBoot.resolve();
      console.log("[RPC] Connected to server");

      // Fetch available editors
      try {
        const editors = await stub.getAvailableEditors();
        if (!disposed) {
          setAvailableEditors(editors);
        }
      } catch (error) {
        console.error("[RPC] Failed to fetch available editors:", error);
      }
    })();

    return () => {
      disposed = true;
      setGlobalRpcStub(null);
      setRpcStub(null);
      setIsConnected(false);
    };
  }, [url, authToken, teamSlugOrId]);

  const contextValue: RpcContextType = useMemo(
    () => ({
      rpcStub,
      isConnected,
      availableEditors,
    }),
    [rpcStub, isConnected, availableEditors],
  );

  return (
    <RpcContext.Provider value={contextValue}>
      {children}
    </RpcContext.Provider>
  );
};