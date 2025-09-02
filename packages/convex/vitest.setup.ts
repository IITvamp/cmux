import { webcrypto } from "node:crypto";

// Ensure Web Crypto API is available (crypto.subtle) in Node.
const needsPolyfill =
  typeof (globalThis as unknown as { crypto?: Crypto }).crypto === "undefined" ||
  typeof (globalThis as unknown as { crypto?: Crypto }).crypto?.subtle ===
    "undefined";

if (needsPolyfill) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}
