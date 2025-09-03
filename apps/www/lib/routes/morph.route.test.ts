import { __TEST_INTERNAL_ONLY_GET_STACK_TOKENS } from "@/lib/test-utils/__TEST_INTERNAL_ONLY_GET_STACK_TOKENS";
import { __TEST_INTERNAL_ONLY_MORPH_CLIENT } from "@/lib/test-utils/__TEST_INTERNAL_ONLY_MORPH_CLIENT";
import { testApiClient } from "@/lib/test-utils/openapi-client";
import { postApiMorphSetupInstance } from "@cmux/www-openapi-client";
import { api } from "@cmux/convex/api";
import { getConvex } from "../utils/get-convex";
import { afterAll, describe, expect, it } from "vitest";

describe("morphRouter - live", () => {
  let createdInstanceId: string | null = null;

  afterAll(async () => {
    if (!createdInstanceId) return;
    try {
      const inst = await __TEST_INTERNAL_ONLY_MORPH_CLIENT.instances.get({
        instanceId: createdInstanceId,
      });
      await inst.stop();
    } catch (e) {
      console.warn("Morph cleanup failed:", e);
    }
  });
  it("rejects unauthenticated requests", async () => {
    const res = await postApiMorphSetupInstance({
      client: testApiClient,
      body: { teamSlugOrId: "manaflow", ttlSeconds: 120 },
    });
    expect(res.response.status).toBe(401);
  });

  it("creates and then reuses an instance with instanceId", async () => {
    // Skip if Morph key is not configured or tokens unavailable
    if (!process.env.MORPH_API_KEY) {
      console.warn("Skipping morph live test: MORPH_API_KEY not set");
      return;
    }
    let tokens: { accessToken: string; refreshToken?: string } | null = null;
    try {
      tokens = await __TEST_INTERNAL_ONLY_GET_STACK_TOKENS();
    } catch (_e) {
      console.warn("Skipping morph live test: could not obtain Stack tokens");
      return;
    }

    // First call: create new instance
    const first = await postApiMorphSetupInstance({
      client: testApiClient,
      headers: { "x-stack-auth": JSON.stringify(tokens) },
      body: { teamSlugOrId: "manaflow", ttlSeconds: 300 },
    });
    expect(first.response.status).toBe(200);
    const firstBody = first.data as unknown as {
      instanceId: string;
      vscodeUrl: string;
      clonedRepos: string[];
      removedRepos: string[];
    };
    expect(typeof firstBody.instanceId).toBe("string");
    expect(firstBody.instanceId.length).toBeGreaterThan(0);
    expect(firstBody.vscodeUrl.includes("/?folder=/root/workspace")).toBe(true);
    createdInstanceId = firstBody.instanceId;

    // Second call: reuse existing instance by passing instanceId
    const second = await postApiMorphSetupInstance({
      client: testApiClient,
      headers: { "x-stack-auth": JSON.stringify(tokens) },
      body: {
        teamSlugOrId: "manaflow",
        instanceId: firstBody.instanceId,
        ttlSeconds: 300,
      },
    });
    expect(second.response.status).toBe(200);
    const secondBody = second.data as unknown as {
      instanceId: string;
      vscodeUrl: string;
      clonedRepos: string[];
      removedRepos: string[];
    };
    expect(secondBody.instanceId).toBe(firstBody.instanceId);
    expect(secondBody.vscodeUrl.includes("/?folder=/root/workspace")).toBe(
      true
    );
  });

  it("denies reusing an instance with a different team", async () => {
    if (!process.env.MORPH_API_KEY) {
      console.warn("Skipping morph live test: MORPH_API_KEY not set");
      return;
    }
    let tokens: { accessToken: string; refreshToken?: string } | null = null;
    try {
      tokens = await __TEST_INTERNAL_ONLY_GET_STACK_TOKENS();
    } catch (_e) {
      console.warn("Skipping morph live test: could not obtain Stack tokens");
      return;
    }

    // Ensure we have an instance to test against
    if (!createdInstanceId) {
      const first = await postApiMorphSetupInstance({
        client: testApiClient,
        headers: { "x-stack-auth": JSON.stringify(tokens) },
        body: { teamSlugOrId: "manaflow", ttlSeconds: 300 },
      });
      if (first.response.status !== 200) {
        console.warn("Skipping: failed to create instance for mismatch test");
        return;
      }
      const firstBody = first.data as unknown as { instanceId: string };
      createdInstanceId = firstBody.instanceId;
    }

    // Find another team the user belongs to
    const convex = getConvex({ accessToken: tokens.accessToken });
    let otherTeamSlugOrId: string | null = null;
    try {
      const memberships = await convex.query(api.teams.listTeamMemberships, {});
      const other = memberships.find((m) => {
        const slug = m.team?.slug ?? null;
        return (slug && slug !== "manaflow") || (!slug && m.teamId !== "manaflow");
      });
      if (other) {
        otherTeamSlugOrId = other.team?.slug ?? other.teamId;
      }
    } catch (_e) {
      // If convex unavailable, skip
    }
    if (!otherTeamSlugOrId) {
      console.warn("Skipping mismatch test: no second team membership found");
      return;
    }

    const res = await postApiMorphSetupInstance({
      client: testApiClient,
      headers: { "x-stack-auth": JSON.stringify(tokens) },
      body: {
        teamSlugOrId: otherTeamSlugOrId,
        instanceId: createdInstanceId!,
        ttlSeconds: 300,
      },
    });
    expect(res.response.status).toBe(403);
  });

  it(
    "clones repos, removes, and re-adds correctly",
    async () => {
      if (!process.env.MORPH_API_KEY) {
        console.warn("Skipping morph live test: MORPH_API_KEY not set");
        return;
      }
      let tokens: { accessToken: string; refreshToken?: string } | null = null;
      try {
        tokens = await __TEST_INTERNAL_ONLY_GET_STACK_TOKENS();
      } catch (_e) {
        console.warn("Skipping morph live test: could not obtain Stack tokens");
        return;
      }

      const R1 = "manaflow-ai/manaflow-ai-cmux-testing-repo-1";
      const R2 = "manaflow-ai/manaflow-ai-cmux-testing-repo-2";
      const R3 = "manaflow-ai/manaflow-ai-cmux-testing-repo-3";
      const N1 = "manaflow-ai-cmux-testing-repo-1";
      const N2 = "manaflow-ai-cmux-testing-repo-2";
      const N3 = "manaflow-ai-cmux-testing-repo-3";

      // Ensure an instance exists for this sequence
      if (!createdInstanceId) {
        const first = await postApiMorphSetupInstance({
          client: testApiClient,
          headers: { "x-stack-auth": JSON.stringify(tokens) },
          body: { teamSlugOrId: "manaflow", ttlSeconds: 900 },
        });
        expect(first.response.status).toBe(200);
        createdInstanceId = (first.data as unknown as { instanceId: string })
          .instanceId;
      }

      // Step A: clone R1 + R2
      const a = await postApiMorphSetupInstance({
        client: testApiClient,
        headers: { "x-stack-auth": JSON.stringify(tokens) },
        body: {
          teamSlugOrId: "manaflow",
          instanceId: createdInstanceId!,
          selectedRepos: [R1, R2],
          ttlSeconds: 900,
        },
      });
      expect(a.response.status).toBe(200);
      const aBody = a.data as unknown as {
        clonedRepos: string[];
        removedRepos: string[];
      };
      // Should have at least cloned these repos; removedRepos may contain pre-existing folders
      expect(aBody.clonedRepos).toEqual(
        expect.arrayContaining([R1, R2])
      );

      // Step B: add R3 (should only clone the new one, not remove R1/R2)
      const b = await postApiMorphSetupInstance({
        client: testApiClient,
        headers: { "x-stack-auth": JSON.stringify(tokens) },
        body: {
          teamSlugOrId: "manaflow",
          instanceId: createdInstanceId!,
          selectedRepos: [R1, R2, R3],
          ttlSeconds: 900,
        },
      });
      expect(b.response.status).toBe(200);
      const bBody = b.data as unknown as {
        clonedRepos: string[];
        removedRepos: string[];
      };
      expect(bBody.clonedRepos).toEqual(expect.arrayContaining([R3]));
      // Must NOT remove R1 or R2 here
      expect(bBody.removedRepos).not.toEqual(
        expect.arrayContaining([N1, N2])
      );

      // Step C: remove R2 (should list R2 as removed, not R1/R3)
      const c = await postApiMorphSetupInstance({
        client: testApiClient,
        headers: { "x-stack-auth": JSON.stringify(tokens) },
        body: {
          teamSlugOrId: "manaflow",
          instanceId: createdInstanceId!,
          selectedRepos: [R1, R3],
          ttlSeconds: 900,
        },
      });
      expect(c.response.status).toBe(200);
      const cBody = c.data as unknown as {
        clonedRepos: string[];
        removedRepos: string[];
      };
      expect(cBody.removedRepos).toEqual(expect.arrayContaining([N2]));
      expect(cBody.removedRepos).not.toEqual(
        expect.arrayContaining([N1, N3])
      );

      // Step D: add R2 back (should clone R2 again, not remove others)
      const d = await postApiMorphSetupInstance({
        client: testApiClient,
        headers: { "x-stack-auth": JSON.stringify(tokens) },
        body: {
          teamSlugOrId: "manaflow",
          instanceId: createdInstanceId!,
          selectedRepos: [R1, R2, R3],
          ttlSeconds: 900,
        },
      });
      expect(d.response.status).toBe(200);
      const dBody = d.data as unknown as {
        clonedRepos: string[];
        removedRepos: string[];
      };
      expect(dBody.clonedRepos).toEqual(expect.arrayContaining([R2]));
      expect(dBody.removedRepos).not.toEqual(
        expect.arrayContaining([N1, N3])
      );
    },
    300_000
  );
});
