import { StackServerApp as StackServerAppJs } from "@stackframe/js";
import { env } from "./convex-env";

const projectId = env.NEXT_PUBLIC_STACK_PROJECT_ID;
const publishableClientKey = env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY;
const secretServerKey = env.STACK_SECRET_SERVER_KEY;

if (!projectId || !publishableClientKey || !secretServerKey) {
  throw new Error("[stackServerAppJs] Missing Stack credentials");
}

export const stackServerAppJs = new StackServerAppJs({
  tokenStore: "memory",
  projectId,
  publishableClientKey,
  secretServerKey,
});

export type StackServerAppJsInstance = typeof stackServerAppJs;
