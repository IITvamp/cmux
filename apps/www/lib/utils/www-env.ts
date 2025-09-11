import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// Skip validation in test environment for CI
const isTest = process.env.NODE_ENV === "test" || process.env.CI === "true";

export const env = createEnv({
  clientPrefix: "NEXT_PUBLIC_",
  server: {
    // Stack server-side env
    STACK_SECRET_SERVER_KEY: isTest ? z.string().optional().default("test") : z.string().min(1),
    STACK_SUPER_SECRET_ADMIN_KEY: isTest ? z.string().optional().default("test") : z.string().min(1),
    STACK_DATA_VAULT_SECRET: isTest ? z.string().optional().default("test-vault-secret-at-least-32-chars") : z.string().min(32), // For secure DataBook storage
    // GitHub App
    CMUX_GITHUB_APP_ID: isTest ? z.string().optional().default("test") : z.string().min(1),
    CMUX_GITHUB_APP_PRIVATE_KEY: isTest ? z.string().optional().default("test") : z.string().min(1),
    // Morph
    MORPH_API_KEY: isTest ? z.string().optional().default("test") : z.string().min(1),
    CONVEX_DEPLOY_KEY: isTest ? z.string().optional().default("test") : z.string().min(1),
    ANTHROPIC_API_KEY: isTest ? z.string().optional().default("test") : z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_STACK_PROJECT_ID: isTest ? z.string().optional().default("test") : z.string().min(1),
    NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY: isTest ? z.string().optional().default("test") : z.string().min(1),
    NEXT_PUBLIC_CONVEX_URL: isTest ? z.string().optional().default("http://test") : z.string().min(1),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
