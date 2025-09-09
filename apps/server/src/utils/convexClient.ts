import { ConvexHttpClient } from "convex/browser";
import { getAuthToken } from "./requestContext.js";
import { env } from "./server-env.js";

// Return a Convex client bound to the current auth context
export function getConvex() {
  const auth = getAuthToken();
  if (!auth) {
    throw new Error("No auth token found");
  }
  const client = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);
  client.setAuth(auth);
  return client;
}

export type { ConvexHttpClient };
