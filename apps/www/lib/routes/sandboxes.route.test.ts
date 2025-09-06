import { __TEST_INTERNAL_ONLY_GET_STACK_TOKENS } from "@/lib/test-utils/__TEST_INTERNAL_ONLY_GET_STACK_TOKENS";
import { testApiClient } from "@/lib/test-utils/openapi-client";
import { postApiSandboxesStart } from "@cmux/www-openapi-client";
import { describe, expect, it } from "vitest";

describe("sandboxesRouter - start access controls", () => {
  it("rejects providing a snapshotId not owned by the team", async () => {
    const tokens = await __TEST_INTERNAL_ONLY_GET_STACK_TOKENS();
    const res = await postApiSandboxesStart({
      client: testApiClient,
      headers: { "x-stack-auth": JSON.stringify(tokens) },
      body: {
        teamSlugOrId: "manaflow",
        snapshotId: "snapshot_does_not_exist_for_team_test",
        ttlSeconds: 60,
      },
    });
    expect(res.response.status).toBe(403);
  });
});

