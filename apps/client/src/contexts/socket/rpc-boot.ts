import type { MainServerRpcStub } from "@cmux/shared";

let globalRpcStub: MainServerRpcStub | null = null;

export function setGlobalRpcStub(stub: MainServerRpcStub | null) {
  globalRpcStub = stub;
}

export function getGlobalRpcStub(): MainServerRpcStub | null {
  return globalRpcStub;
}

// Boot promise for suspense support
let _resolve: (() => void) | null = null;
let _reject: ((err: Error) => void) | null = null;

export const rpcBoot = {
  promise: new Promise<void>((resolve, reject) => {
    _resolve = resolve;
    _reject = reject;
  }),
  resolve: () => {
    if (_resolve) {
      _resolve();
    }
  },
  reject: (err: Error) => {
    if (_reject) {
      _reject(err);
    }
  },
};