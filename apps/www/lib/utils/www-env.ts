import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "NEXT_PUBLIC_",
  server: {
    // Stack server-side env
    VITE_STACK_PROJECT_ID: z.string().min(1),
    VITE_STACK_PUBLISHABLE_CLIENT_KEY: z.string().min(1),
    STACK_SECRET_SERVER_KEY: z.string().min(1),
    STACK_SUPER_SECRET_ADMIN_KEY: z.string().min(1),
    // GitHub App
    GITHUB_APP_ID: z.string().min(1),
    GITHUB_APP_PRIVATE_KEY: z.string().min(1),
    // Morph
    MORPH_API_KEY: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_CONVEX_URL: z.string().min(1),
    NEXT_PUBLIC_STACK_PROJECT_ID: z.string().min(1),
    NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY: z.string().min(1),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
