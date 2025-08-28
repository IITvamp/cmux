import { ConvexHttpClient } from "convex/browser";
import { getAuthToken } from "./requestContext.js";

export const CONVEX_URL =
  process.env.VITE_CONVEX_URL || "http://127.0.0.1:9777";

// Return a Convex client bound to the current auth context
export function getConvex(): ConvexHttpClient {
  const auth = getAuthToken();
  return new ConvexHttpClient(CONVEX_URL, auth ? { auth } : undefined);
}

export type { ConvexHttpClient };
