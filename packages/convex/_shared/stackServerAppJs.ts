import { StackServerApp as StackServerAppJs } from "@stackframe/js";
import { env } from "./convex-env";

type StackServerAppJsInstance = InstanceType<typeof StackServerAppJs>;

type MaybeStackServerApp = StackServerAppJsInstance | null;

const projectId = env.NEXT_PUBLIC_STACK_PROJECT_ID;
const publishableClientKey = env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY;
const secretServerKey = env.STACK_SECRET_SERVER_KEY;

const stackServerAppInstance: MaybeStackServerApp = (() => {
  if (!projectId || !publishableClientKey || !secretServerKey) {
    console.warn("[stackServerAppJs] Missing Stack credentials; returning null");
    return null;
  }

  try {
    return new StackServerAppJs({
      tokenStore: "memory",
      projectId,
      publishableClientKey,
      secretServerKey,
    });
  } catch (error) {
    console.error("[stackServerAppJs] Failed to create Stack server client", error);
    return null;
  }
})();

export function stackServerAppJs(): MaybeStackServerApp {
  return stackServerAppInstance;
}

export type { MaybeStackServerApp };
