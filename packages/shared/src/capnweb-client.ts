import { newHttpBatchRpcSession, newWebSocketRpcSession, type RpcStub } from "capnweb";
import type { IMainServerRpc, IWorkerManagementRpc, IVSCodeRpc } from "./rpc-interfaces";

/**
 * Create an RPC session to the main server over HTTP
 */
export function connectToMainServer(params: {
  url: string;
  authToken: string;
  teamSlugOrId?: string;
  authJson?: unknown;
}): RpcStub<IMainServerRpc> {
  // Build query parameters for authentication
  const queryParams = new URLSearchParams();
  queryParams.set("auth", params.authToken);
  if (params.teamSlugOrId) {
    queryParams.set("team", params.teamSlugOrId);
  }
  if (params.authJson !== undefined) {
    queryParams.set("auth_json", JSON.stringify(params.authJson));
  }

  const urlWithParams = `${params.url}?${queryParams.toString()}`;

  // Use HTTP batch RPC for the main server connection
  return newHttpBatchRpcSession<IMainServerRpc>(urlWithParams);
}

/**
 * Create a WebSocket RPC session to the main server
 */
export function connectToMainServerWebSocket(params: {
  url: string;
  authToken: string;
  teamSlugOrId?: string;
  authJson?: unknown;
}): RpcStub<IMainServerRpc> {
  // Build query parameters for authentication
  const queryParams = new URLSearchParams();
  queryParams.set("auth", params.authToken);
  if (params.teamSlugOrId) {
    queryParams.set("team", params.teamSlugOrId);
  }
  if (params.authJson !== undefined) {
    queryParams.set("auth_json", JSON.stringify(params.authJson));
  }

  const urlWithParams = `${params.url}?${queryParams.toString()}`;

  // Use WebSocket RPC for persistent connection
  return newWebSocketRpcSession<IMainServerRpc>(urlWithParams);
}

/**
 * Connect to worker management interface
 */
export function connectToWorkerManagement(params: {
  url: string;
  timeoutMs?: number;
  reconnectionAttempts?: number;
  forceNew?: boolean;
}): RpcStub<IWorkerManagementRpc> {
  const managementUrl = `${params.url}/management`;

  // Use WebSocket RPC for worker management
  return newWebSocketRpcSession<IWorkerManagementRpc>(managementUrl);
}

/**
 * Connect to VSCode extension
 */
export function connectToVSCode(params: {
  url: string;
}): RpcStub<IVSCodeRpc> {
  // Use WebSocket RPC for VSCode connection
  return newWebSocketRpcSession<IVSCodeRpc>(params.url);
}