import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "NEXT_PUBLIC_",
  server: {
    STACK_SECRET_SERVER_KEY: z.string().default(""),
  },
  client: {
    NEXT_PUBLIC_STACK_PROJECT_ID: z.string().default(""),
    NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY: z.string().default(""),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
