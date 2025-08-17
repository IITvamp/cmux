import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    STACK_PROJECT_ID: z.string().default(""),
    STACK_PUBLISHABLE_CLIENT_KEY: z.string().default(""),
    STACK_SECRET_SERVER_KEY: z.string().default(""),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
