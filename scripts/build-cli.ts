#!/usr/bin/env bun

import { $ } from "bun";
import { spawn } from "node:child_process";
import cmuxPackageJson from "../packages/cmux/package.json";

// Check if port 9777 is already in use
console.log("Checking if port 9777 is available...");
try {
  const lsofResult = await $`lsof -i :9777`.text();
  const output = lsofResult.trim();
  if (output) {
    console.log("Port 9777 is already in use. Processes using this port:");
    console.log(output);
    console.log("Please stop these processes before running this script.");
    process.exit(1);
  }
} catch (error) {
  // lsof returns exit code 1 when no processes are found, which is what we want
  console.log("Port 9777 is available.");
}

// Build the client with the correct VITE_CONVEX_URL
console.log("Building client app...");
await $`cd ./apps/client && VITE_CONVEX_URL=http://localhost:9777 pnpm build`;

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

console.log("Killing convex backend");
convexBackendProcess.kill();

// Create a temp directory for the cmux bundle
await $`mkdir -p /tmp/cmux-bundle`;

// Copy convex-bundle contents
await $`cp -r ./packages/cmux/src/convex/convex-bundle/* /tmp/cmux-bundle/`;

// Copy the correct package.json from cmux package (overwrite the convex one)
await $`cp ./packages/cmux/package.json /tmp/cmux-bundle/`;

// Copy public files
await $`mkdir -p /tmp/cmux-bundle/public`;
await $`cp -r ./packages/cmux/public/dist /tmp/cmux-bundle/public/`;

// Create the cmux-bundle.zip
await $`cd /tmp && zip -r cmux-bundle.zip cmux-bundle`;
await $`mv /tmp/cmux-bundle.zip ./packages/cmux/src/convex/`;

// Clean up temp directory
await $`rm -rf /tmp/cmux-bundle`;

const VERSION = cmuxPackageJson.version;

// bun build the cli
await $`bun build ./packages/cmux/src/cli.ts --compile --define VERSION=${VERSION} --define process.env.WORKER_IMAGE_NAME=lawrencecchen/cmux@latest --outfile cmux-cli`;
console.log("Built cmux-cli");

// exit with 0
process.exit(0);
