let convexAuthReadyPromiseResolveFn: (() => void) | null = null;
export const convexAuthReadyPromise = new Promise<void>((resolve) => {
  convexAuthReadyPromiseResolveFn = resolve;
});

export function signalConvexAuthReady() {
  convexAuthReadyPromiseResolveFn?.();
}
