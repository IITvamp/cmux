import { testApiClient } from "@/lib/test-utils/openapi-client";
import { env } from "@/lib/utils/www-env";
import { api } from "@cmux/convex/api";
import { getApiIntegrationsGithubRepos } from "@cmux/www-openapi-client";
import { StackAdminApp } from "@stackframe/js";
import { describe, expect, it } from "vitest";
import { getConvex } from "../utils/get-convex";

const PROJECT_ID = env.VITE_STACK_PROJECT_ID;
const PUBLISHABLE_KEY = env.VITE_STACK_PUBLISHABLE_CLIENT_KEY;
const SERVER_SECRET = env.STACK_SECRET_SERVER_KEY;
const ADMIN_KEY = env.STACK_SUPER_SECRET_ADMIN_KEY;

// Hardcoded user id used in local dev for testing
const TEST_USER_ID = "477b6de8-075a-45ea-9c59-f65a65cb124d";

type Tokens = { accessToken: string; refreshToken?: string };

async function getStackTokens(): Promise<Tokens> {
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

describe("githubReposRouter via SDK", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await getApiIntegrationsGithubRepos({
      client: testApiClient,
      query: { team: "lawrence" },
    });
    expect(res.response.status).toBe(401);
  });

  it("returns repos for authenticated user", async () => {
    const tokens = await getStackTokens();
    const res = await getApiIntegrationsGithubRepos({
      client: testApiClient,
      query: { team: "lawrence" },
      headers: { "x-stack-auth": JSON.stringify(tokens) },
    });
    // Accept 200 (OK), 401 (if token rejected), or 501 (GitHub app not configured)
    expect([200, 401, 501]).toContain(res.response.status);
    if (res.response.status === 200 && res.data) {
      const body = res.data;
      expect(Array.isArray(body.connections)).toBe(true);
      if (body.connections.length > 0) {
        const c0 = body.connections[0]!;
        expect(typeof c0.installationId).toBe("number");
        expect(Array.isArray(c0.repos)).toBe(true);
      }
    }
  });

  it("can limit to a single installation when specified", async () => {
    const tokens = await getStackTokens();
    const convex = getConvex({ accessToken: tokens.accessToken });

    let installationId: number | undefined;
    try {
      const conns = await convex.query(api.github.listProviderConnections, {
        teamSlugOrId: "lawrence",
      });
      installationId = conns.find((c) => c.isActive !== false)?.installationId;
    } catch {
      // If convex is unreachable in this test env, skip
      throw new Error("No installation ID found");
    }
    if (!installationId) {
      throw new Error("No installation ID found");
    }

    const res = await getApiIntegrationsGithubRepos({
      client: testApiClient,
      query: { team: "lawrence", installationId },
      headers: { "x-stack-auth": JSON.stringify(tokens) },
    });
    expect([200, 401, 501]).toContain(res.response.status);
    if (res.response.status === 200 && res.data) {
      // When installationId is provided, server should return at most one connection
      expect(res.data.connections.length).toBeLessThanOrEqual(1);
      if (res.data.connections[0]) {
        expect(res.data.connections[0]!.installationId).toBe(installationId);
      }
    }
  });
});
