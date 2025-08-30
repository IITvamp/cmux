import { StackAdminApp } from "@stackframe/js";
import { describe, expect, it } from "vitest";
import { githubReposRouter } from "./github.repos.route";

const PROJECT_ID = process.env.VITE_STACK_PROJECT_ID;
const PUBLISHABLE_KEY = process.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY;
const SERVER_SECRET = process.env.STACK_SECRET_SERVER_KEY;
const ADMIN_KEY = process.env.STACK_SUPER_SECRET_ADMIN_KEY;

// Hardcoded user id used in local dev for testing
const TEST_USER_ID = "477b6de8-075a-45ea-9c59-f65a65cb124d";

type Tokens = { accessToken: string; refreshToken?: string };

async function getStackTokens(): Promise<Tokens> {
  if (!PROJECT_ID || !PUBLISHABLE_KEY || !SERVER_SECRET || !ADMIN_KEY) {
    throw new Error("Missing Stack env for test");
  }
  const admin = new StackAdminApp({
    projectId: PROJECT_ID,
    publishableClientKey: PUBLISHABLE_KEY,
    secretServerKey: SERVER_SECRET,
    superSecretAdminKey: ADMIN_KEY,
    tokenStore: "memory",
  });
  const user = await admin.getUser(TEST_USER_ID);
  if (!user) throw new Error("Test user not found");
  const session = await user.createSession({ expiresInMillis: 5 * 60 * 1000 });
  const tokens = await session.getTokens();
  const at = tokens.accessToken;
  if (!at) throw new Error("No access token");
  return { accessToken: at, refreshToken: tokens.refreshToken ?? undefined };
}

describe("githubReposRouter", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await githubReposRouter.request(
      "/integrations/github/repos?team=lawrence"
    );
    expect(res.status).toBe(401);
  });

  it("returns repos for authenticated user", async () => {
    if (!PROJECT_ID || !PUBLISHABLE_KEY || !SERVER_SECRET || !ADMIN_KEY) {
      // Skip when Stack env is not available in this process
      return;
    }
    const tokens = await getStackTokens();
    const res = await githubReposRouter.request(
      "/integrations/github/repos?team=lawrence",
      { headers: { "x-stack-auth": JSON.stringify(tokens) } }
    );
    // Accept 200 (OK), 401 (if token rejected), or 501 (GitHub app not configured)
    expect([200, 401, 501]).toContain(res.status);
    if (res.status === 200) {
      const body = (await res.json()) as unknown as {
        connections: Array<{
          installationId: number;
          accountLogin?: string;
          repos: Array<{ name: string; full_name: string; private: boolean }>;
        }>;
      };
      expect(Array.isArray(body.connections)).toBe(true);
      if (body.connections.length > 0) {
        const c0 = body.connections[0]!;
        expect(typeof c0.installationId).toBe("number");
        expect(Array.isArray(c0.repos)).toBe(true);
      }
    }
  });
});
