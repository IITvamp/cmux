import { env } from "@/lib/utils/www-env";
import { StackServerApp } from "@stackframe/stack";

console.log(env);

export const stackServerApp = new StackServerApp({
  projectId: env.NEXT_PUBLIC_STACK_PROJECT_ID,
  publishableClientKey: env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY,
  secretServerKey: env.STACK_SECRET_SERVER_KEY,
  tokenStore: "nextjs-cookie",
});
