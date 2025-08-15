import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    STACK_PROJECT_ID: z.string().min(1),
    STACK_PUBLISHABLE_CLIENT_KEY: z.string().min(1),
    STACK_SECRET_SERVER_KEY: z.string().min(1),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
