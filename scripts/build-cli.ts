#!/usr/bin/env bun

import { $ } from "bun";
import { spawn } from "node:child_process";

await $`cp -r ./apps/client/dist ./packages/cmux/public`;
await $`bun build ./packages/cmux/node_modules/convex/dist/cli.bundle.cjs --outdir ./packages/cmux/src/convex/convex-bundle/convex-cli-dist --outfile convex-cli.cjs --target bun --minify`;

const convexBackendProcess = spawn(
  "./convex-local-backend",
  [
    "--port",
    "9777",
    "--site-proxy-port",
    process.env.CONVEX_SITE_PROXY_PORT || "9778",
    "--instance-name",
    process.env.CONVEX_INSTANCE_NAME || "cmux-dev",
    "--instance-secret",
    process.env.CONVEX_INSTANCE_SECRET ||
      "29dd272e3cd3cce53ff444cac387925c2f6f53fd9f50803a24e5a11832d36b9c",
    "--disable-beacon",
  ],
  {
    cwd: "./packages/cmux/src/convex/convex-bundle",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  }
);

let instance: Response | undefined;
let retries = 0;
const maxRetries = 100;

while ((!instance || !instance.ok) && retries < maxRetries) {
  console.log("Waiting for instance to be ready", retries);
  try {
    instance = await fetch(`http://localhost:9777/`);
  } catch (error) {
    // Ignore fetch errors and continue retrying
  }

  if (!instance || !instance.ok) {
    retries++;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

if (!instance || !instance.ok) {
  throw new Error(
    `Failed to connect to Convex instance after ${maxRetries} retries`
  );
}

console.log("Deploying convex");

await $`cd ./packages/cmux/src/convex/convex-bundle && bunx convex deploy`;

convexBackendProcess.kill();

// Finally, zip the convex-bundle directory

await $`zip -r ./packages/cmux/src/convex/convex-bundle.zip ./packages/cmux/src/convex/convex-bundle`;

// exit with 0
process.exit(0);
