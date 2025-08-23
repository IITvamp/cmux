import { StackServerApp } from "@stackframe/js";
import { env } from "./www-env";

export const stackServerApp = new StackServerApp({
  projectId: env.VITE_STACK_PROJECT_ID,
  publishableClientKey: env.VITE_STACK_PUBLISHABLE_CLIENT_KEY,
  secretServerKey: env.STACK_SECRET_SERVER_KEY,
  tokenStore: "memory",
});
