import { newHttpBatchRpcSession, type RpcStub } from "capnweb";
import type { IMainServerRpc } from "./rpc-interfaces";

export interface MainRpcClientParams {
  url: string;
  authToken: string;
  teamSlugOrId?: string;
  authJson?: unknown;
}

/**
 * Connects to the main server using capnweb RPC.
 * Returns an RPC stub that can call methods on IMainServerRpc.
 */
export function connectToMainServerRpc(
  params: MainRpcClientParams
): RpcStub<IMainServerRpc> {
  const { url, authToken, teamSlugOrId, authJson } = params;
  
  // Build query string for authentication
  const queryParams = new URLSearchParams({
    auth: authToken,
  });
  
  if (teamSlugOrId) {
    queryParams.set("team", teamSlugOrId);
  }
  
  if (authJson !== undefined) {
    queryParams.set("auth_json", JSON.stringify(authJson));
  }
  
  // Create RPC session with HTTP batch transport
  const rpcUrl = `${url}/rpc?${queryParams.toString()}`;
  const stub = newHttpBatchRpcSession<IMainServerRpc>(rpcUrl);
  
  return stub;
}

// Type for the RPC stub
export type MainServerRpcStub = RpcStub<IMainServerRpc>;