import { env } from "@/lib/utils/www-env";
import { StackServerApp } from "@stackframe/stack";

export const stackServerApp = new StackServerApp({
  projectId: env.NEXT_PUBLIC_STACK_PROJECT_ID,
  publishableClientKey: env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY,
  secretServerKey: env.STACK_SECRET_SERVER_KEY,
  tokenStore: "nextjs-cookie",
  // After sign-in/up in the browser, bounce back to Electron via custom protocol
  urls: {
    afterSignIn: "/handler/after-sign-in",
    afterSignUp: "/handler/after-sign-in",
  },
});
