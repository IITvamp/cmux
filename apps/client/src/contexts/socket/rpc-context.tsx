import type { MainServerRpcStub } from "@cmux/shared";
import type { AvailableEditors } from "@cmux/shared";
import { createContext } from "react";

export interface RpcContextType {
  rpcStub: MainServerRpcStub | null;
  isConnected: boolean;
  availableEditors: AvailableEditors | null;
}

export const RpcContext = createContext<RpcContextType | undefined>(undefined);