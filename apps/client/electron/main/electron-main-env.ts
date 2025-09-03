import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {},
  clientPrefix: "NEXT_PUBLIC_",
  client: {
    NEXT_PUBLIC_STACK_PROJECT_ID: z.string().min(1),
  },
  // Electron main is bundled by Vite (electron-vite), so use import.meta.env
  // to read variables loaded from .env files (filtered by envPrefix).
  runtimeEnv: import.meta.env as unknown as Record<
    string,
    string | number | boolean | undefined
  >,
  emptyStringAsUndefined: true,
});
