import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    VITE_STACK_PROJECT_ID: z.string().default(""),
    VITE_STACK_PUBLISHABLE_CLIENT_KEY: z.string().default(""),
    STACK_SECRET_SERVER_KEY: z.string().default(""),
    GITHUB_APP_ID: z.string().optional(),
    GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
