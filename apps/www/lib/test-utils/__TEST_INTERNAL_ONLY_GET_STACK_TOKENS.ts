import { env } from "@/lib/utils/www-env";
import StackframePkg from "@stackframe/js";

type StackModule = {
  StackAdminApp?: typeof import("@stackframe/js").StackAdminApp;
  default?: { StackAdminApp?: typeof import("@stackframe/js").StackAdminApp };
};

const stackModule = StackframePkg as StackModule;
const StackAdminAppCtor =
  stackModule.StackAdminApp ?? stackModule.default?.StackAdminApp;

if (!StackAdminAppCtor) {
  throw new Error("StackAdminApp export not found in @stackframe/js");
}

const StackAdminApp = StackAdminAppCtor;
type StackAdminAppType = import("@stackframe/js").StackAdminApp;

export type Tokens = { accessToken: string; refreshToken?: string };

// Default test user for local/CI integration tests
const DEFAULT_TEST_USER_ID = "487b5ddc-0da0-4f12-8834-f452863a83f5";

let adminApp: StackAdminAppType | null = null;

function getAdmin(): StackAdminAppType {
  if (!adminApp) {
    adminApp = new StackAdminApp({
      projectId: env.NEXT_PUBLIC_STACK_PROJECT_ID,
      publishableClientKey: env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY,
      secretServerKey: env.STACK_SECRET_SERVER_KEY,
      superSecretAdminKey: env.STACK_SUPER_SECRET_ADMIN_KEY,
      tokenStore: "memory",
    });
  }
  return adminApp;
}

export async function __TEST_INTERNAL_ONLY_GET_STACK_TOKENS(userId: string = DEFAULT_TEST_USER_ID): Promise<Tokens> {
  const admin = getAdmin();
  const user = await admin.getUser(userId);
  if (!user) throw new Error("Test user not found");
  const session = await user.createSession({ expiresInMillis: 5 * 60 * 1000 });
  const tokens = await session.getTokens();
  const accessToken = tokens.accessToken;
  if (!accessToken) throw new Error("No access token");
  return { accessToken, refreshToken: tokens.refreshToken ?? undefined };
}
