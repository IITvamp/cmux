let convexAuthReadyPromiseResolveFn:
  | ((isAuthenticated: boolean) => void)
  | null = null;
export const convexAuthReadyPromise = new Promise<boolean>((resolve) => {
  convexAuthReadyPromiseResolveFn = resolve;
});

export function signalConvexAuthReady(isAuthenticated: boolean) {
  console.log("signalConvexAuthReady", isAuthenticated);
  convexAuthReadyPromiseResolveFn?.(isAuthenticated);
}
