import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Preferred base URL for the WWW (Hono) API
    WWW_API_BASE_URL: z.url().optional(),
    // Back-compat alias used elsewhere
    CMUX_WWW_API_URL: z.url().optional(),
    NEXT_PUBLIC_CONVEX_URL: z.string().min(1),
    // Optional server-owned AI provider keys for server-side generation
    OPENAI_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
  },
  // Handle both Node and Vite/Bun
  runtimeEnv: { ...import.meta.env, ...process.env },
  emptyStringAsUndefined: true,
});

export function getWwwBaseUrl(): string {
  // Read from live process.env first to support tests that mutate env at runtime
  return (
    process.env.WWW_API_BASE_URL ||
    process.env.CMUX_WWW_API_URL ||
    env.WWW_API_BASE_URL ||
    env.CMUX_WWW_API_URL ||
    "http://localhost:9779"
  );
}
