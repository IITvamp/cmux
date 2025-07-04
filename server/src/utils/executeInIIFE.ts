export function executeInIIFE<T>(code: () => T | Promise<T>): void {
  try {
    // Execute the function in an IIFE
    (async () => {
      await code();
    })();
  } catch (error) {
    console.error("Error executing code:", error);
  }
}
