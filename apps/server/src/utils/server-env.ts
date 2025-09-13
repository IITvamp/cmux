import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Preferred base URL for the WWW (Hono) API
    WWW_API_BASE_URL: z.url().optional(),
    // Back-compat alias used elsewhere
    CMUX_WWW_API_URL: z.url().optional(),
    // Public origin used across the app; prefer this for WWW base URL
    NEXT_PUBLIC_WWW_ORIGIN: z.string().min(1).optional(),
    NEXT_PUBLIC_CONVEX_URL: z.string().min(1),
  },
  // Handle both Node and Vite/Bun
  runtimeEnv: { ...import.meta.env, ...process.env },
  emptyStringAsUndefined: true,
});

export function getWwwBaseUrl(): string {
  // Read from live process.env first to support tests that mutate env at runtime
  return (
    // Prefer the public origin for the WWW app when available
    process.env.NEXT_PUBLIC_WWW_ORIGIN ||
    env.NEXT_PUBLIC_WWW_ORIGIN ||
    // Backwards compatibility with older env vars
    process.env.WWW_API_BASE_URL ||
    process.env.CMUX_WWW_API_URL ||
    env.WWW_API_BASE_URL ||
    env.CMUX_WWW_API_URL ||
    "http://localhost:9779"
  );
}
