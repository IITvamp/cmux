import pkg from "@stackframe/js";
const { StackServerApp } = pkg;
import { env } from "./env.js";

export const stackServerApp = new StackServerApp({
  projectId: env.STACK_PROJECT_ID,
  publishableClientKey: env.STACK_PUBLISHABLE_CLIENT_KEY,
  secretServerKey: env.STACK_SECRET_SERVER_KEY,
  tokenStore: "memory",
});
