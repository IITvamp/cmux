#!/usr/bin/env bun
import "dotenv/config";
import { MorphCloudClient } from "morphcloud";
import { execInRootfs } from "../apps/www/lib/routes/sandboxes/shell";

const snapshotId =
  process.argv[2] ??
  process.env.CMUX_TEST_SNAPSHOT ??
  process.env.MORPH_SNAPSHOT_ID ??
  "";

if (!snapshotId) {
  console.error(
    "Usage: bun scripts/verify-gh-rootfs.ts <snapshot-id>\n" +
      "Provide a snapshot id as an argument or set CMUX_TEST_SNAPSHOT / MORPH_SNAPSHOT_ID."
  );
  process.exit(1);
}

const client = new MorphCloudClient();

const instancePromise = client.instances.start({ snapshotId });
let instanceClosed = false;

const stopInstance = async () => {
  if (instanceClosed) return;
  instanceClosed = true;
  const instance = await instancePromise;
  try {
    await instance.stop();
    // eslint-disable-next-line no-empty
  } catch {}
};

process.on("SIGINT", async () => {
  await stopInstance();
  process.exit(130);
});

try {
  console.log(`[verify-gh-rootfs] Starting instance from ${snapshotId}...`);
  const instance = await instancePromise;
  await instance.waitUntilReady();
  console.log(
    `[verify-gh-rootfs] Instance ready (id=${instance.id}). Running checks...`
  );

  const version = await execInRootfs(instance, ["/usr/bin/gh", "--version"]);
  if (version.exit_code !== 0) {
    throw new Error(
      `gh --version failed inside rootfs (exit ${version.exit_code}). stderr=${version.stderr}`
    );
  }

  console.log("[verify-gh-rootfs] gh --version stdout:");
  console.log(version.stdout.trim());

  const scriptSmoke = [
    "set -euo pipefail",
    'echo script helper ok',
  ].join("\n");
  const scriptRun = await execInRootfs(instance, scriptSmoke);
  if (scriptRun.exit_code !== 0) {
    throw new Error(
      `rootfs script helper failed with exit ${scriptRun.exit_code}. stderr=${scriptRun.stderr}`
    );
  }
  console.log("[verify-gh-rootfs] execInRootfs script output:");
  console.log(scriptRun.stdout.trim());

  console.log("[verify-gh-rootfs] All checks passed.");
} catch (error) {
  console.error("[verify-gh-rootfs] Error:", error);
  process.exitCode = 1;
} finally {
  await stopInstance();
}
