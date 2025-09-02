import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    STACK_WEBHOOK_SECRET: z.string().min(1),
    GITHUB_APP_WEBHOOK_SECRET: z.string().min(1).optional(),
    INSTALL_STATE_SECRET: z.string().min(1).optional(),
    NEXT_PUBLIC_STACK_PROJECT_ID: z.string().optional(),
    BASE_APP_URL: z.string().min(1),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
