import { ConvexHttpClient } from "convex/browser";
import { env } from "./www-env";

export function getConvex({ accessToken }: { accessToken: string }) {
  const client = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);
  client.setAuth(accessToken);
  return client;
}
