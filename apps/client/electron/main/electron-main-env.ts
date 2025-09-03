import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {},
  clientPrefix: "NEXT_PUBLIC_",
  client: {
    NEXT_PUBLIC_STACK_PROJECT_ID: z.string().min(1),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
