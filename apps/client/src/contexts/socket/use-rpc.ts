import { useContext } from "react";
import { rpcBoot } from "./rpc-boot";
import { RpcContext } from "./rpc-context";
import type { RpcContextType } from "./rpc-context";

export function useRpc() {
  const context = useContext(RpcContext);
  if (context === undefined) {
    throw new Error("useRpc must be used within an RpcProvider");
  }
  return context;
}

// Suspense variant: only returns when a connected RPC stub is available.
// Otherwise throws a Promise to suspend until first successful connection
// or throws an Error if the initial connection fails.
export function useRpcSuspense() {
  const ctx = useRpc();
  const rpcStub = ctx.rpcStub;

  if (rpcStub && ctx.isConnected) {
    // Narrow type: rpcStub is non-null when connected
    return ctx as typeof ctx & { rpcStub: NonNullable<RpcContextType["rpcStub"]> };
  }

  // RPC not connected yet: suspend until the provider signals boot readiness
  throw rpcBoot.promise;
}