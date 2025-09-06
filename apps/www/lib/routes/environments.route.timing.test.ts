import { __TEST_INTERNAL_ONLY_GET_STACK_TOKENS } from "@/lib/test-utils/__TEST_INTERNAL_ONLY_GET_STACK_TOKENS";
import { __TEST_INTERNAL_ONLY_MORPH_CLIENT } from "@/lib/test-utils/__TEST_INTERNAL_ONLY_MORPH_CLIENT";
import { testApiClient } from "@/lib/test-utils/openapi-client";
import { DEFAULT_MORPH_SNAPSHOT_ID } from "@/lib/utils/morph-defaults";
import {
  deleteApiEnvironmentsById,
  postApiEnvironments,
} from "@cmux/www-openapi-client";
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

describe("environmentsRouter - snapshot timing (live)", () => {
  it(
    "measures time to create a snapshot via /environments",
    async () => {
      const tokens = await __TEST_INTERNAL_ONLY_GET_STACK_TOKENS();

      // Start a Morph instance from the default snapshot for this measurement
      const started = await __TEST_INTERNAL_ONLY_MORPH_CLIENT.instances.start({
        snapshotId: DEFAULT_MORPH_SNAPSHOT_ID,
        ttlSeconds: 5 * 60,
        ttlAction: "pause",
        metadata: { test: "cmux-snapshot-timing" },
      });

      let envId: string | null = null;
      try {
        const unique = randomUUID().slice(0, 8);
        const startedAt = Date.now();
        const res = await postApiEnvironments({
          client: testApiClient,
          headers: { "x-stack-auth": JSON.stringify(tokens) },
          body: {
            teamSlugOrId: "manaflow",
            name: `snapshot-timing-${unique}`,
            morphInstanceId: started.id,
            envVarsContent: "FOO=bar",
            description: "Automated snapshot timing test",
          },
        });
        const finishedAt = Date.now();

        expect(res.response.status).toBe(200);

        const { id, snapshotId } = res.data as unknown as {
          id: string;
          snapshotId: string;
        };
        envId = id;

        // Persist a simple timing log for retrieval after tests
        try {
          // Vitest runs with cwd at apps/www; repo root is two levels up
          const logsDir = join(process.cwd(), "..", "..", "logs");
          mkdirSync(logsDir, { recursive: true });
          const logPath = join(logsDir, "snapshot-timing.log");
          const durationMs = finishedAt - startedAt;
          const line = `snapshot_duration_ms=${durationMs} instance_id=${started.id} snapshot_id=${snapshotId} env_id=${id}`;
          writeFileSync(logPath, line + "\n");
        } catch {
          // Best-effort only
        }
      } finally {
        // Cleanup: delete environment record if created and stop the instance
        if (envId) {
          await deleteApiEnvironmentsById({
            client: testApiClient,
            headers: { "x-stack-auth": JSON.stringify(tokens) },
            path: { id: envId },
            query: { teamSlugOrId: "manaflow" },
          }).catch(() => {});
        }
        await __TEST_INTERNAL_ONLY_MORPH_CLIENT.instances
          .get({ instanceId: started.id })
          .then((inst) => inst.stop())
          .catch(() => {});
      }
    },
    300_000
  );
});
