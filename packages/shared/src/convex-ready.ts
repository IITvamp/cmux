const onConvexReadyListeners: (() => void)[] = [];

export async function onConvexReady() {
  return new Promise((resolve) => {
    onConvexReadyListeners.push(() => resolve(true));
  });
}

export function emitConvexReady() {
  onConvexReadyListeners.forEach((listener) => listener());
}
