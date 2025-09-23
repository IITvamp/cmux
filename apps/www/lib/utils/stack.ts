import { env } from "@/lib/utils/www-env";
import * as StackframeJsPkg from "@stackframe/js";
import * as StackframeStackPkg from "@stackframe/stack";

type StackServerAppJsType = import("@stackframe/js").StackServerApp<true, string>;
type StackServerAppType = import("@stackframe/stack").StackServerApp<true, string>;

type StackServerAppJsCtor = new (...args: ConstructorParameters<typeof import("@stackframe/js").StackServerApp>) => import("@stackframe/js").StackServerApp;
type StackServerAppCtorType = new (...args: ConstructorParameters<typeof import("@stackframe/stack").StackServerApp>) => import("@stackframe/stack").StackServerApp;

const resolveExport = (mod: unknown, key: string) => {
  const moduleObj = mod as { [k: string]: unknown; default?: Record<string, unknown> };
  return (moduleObj && moduleObj[key]) ?? moduleObj?.default?.[key];
};

const StackServerAppJsCtorResolved = resolveExport(StackframeJsPkg, "StackServerApp") as StackServerAppJsCtor | undefined;
const StackServerAppCtorResolved = resolveExport(StackframeStackPkg, "StackServerApp") as StackServerAppCtorType | undefined;

if (!StackServerAppJsCtorResolved || !StackServerAppCtorResolved) {
  throw new Error("StackServerApp export not found in stackframe packages");
}

export const stackServerApp = new StackServerAppCtorResolved({
  projectId: env.NEXT_PUBLIC_STACK_PROJECT_ID,
  publishableClientKey: env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY,
  secretServerKey: env.STACK_SECRET_SERVER_KEY,
  tokenStore: "nextjs-cookie",
  urls: {
    afterSignIn: "/handler/after-sign-in",
    afterSignUp: "/handler/after-sign-in",
  },
}) as StackServerAppType;

export const stackServerAppJs = new StackServerAppJsCtorResolved({
  projectId: env.NEXT_PUBLIC_STACK_PROJECT_ID,
  publishableClientKey: env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY,
  secretServerKey: env.STACK_SECRET_SERVER_KEY,
  tokenStore: "cookie",
}) as StackServerAppJsType;
