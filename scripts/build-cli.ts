#!/usr/bin/env bun

import { $ } from "bun";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
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

console.log("Checking if convex-local-backend is available...");
// If missing packages/convex/convex-local-backend, download it from github
// https://github.com/get-convex/convex-backend/releases/download/precompiled-2025-07-28-76e3da1/convex-local-backend-aarch64-apple-darwin.zip
// const convexZipUrl =
//   "https://github.com/get-convex/convex-backend/releases/download/precompiled-2025-07-14-19aed7a/convex-local-backend-aarch64-apple-darwin.zip";
const convexZipUrl =
  "https://github.com/get-convex/convex-backend/releases/download/precompiled-2025-07-11-74f2e87/convex-local-backend-aarch64-apple-darwin.zip";
if (
  !existsSync("./packages/cmux/src/convex/convex-bundle/convex-local-backend")
) {
  console.log("Downloading convex-local-backend...");

  // Ensure the directory exists
  await $`mkdir -p ./packages/cmux/src/convex/convex-bundle`;

  // Download with proper error handling
  const downloadResult =
    await $`curl -L ${convexZipUrl} -o ./packages/cmux/src/convex/convex-bundle/convex-local-backend.zip --fail`.quiet();

  if (downloadResult.exitCode !== 0) {
    throw new Error("Failed to download convex-local-backend");
  }

  // Verify the download is a valid zip file
  const fileCheck =
    await $`file ./packages/cmux/src/convex/convex-bundle/convex-local-backend.zip`.text();
  if (!fileCheck.includes("Zip archive")) {
    throw new Error("Downloaded file is not a valid zip archive");
  }

  await $`unzip -o ./packages/cmux/src/convex/convex-bundle/convex-local-backend.zip -d ./packages/cmux/src/convex/convex-bundle/`;
  await $`rm ./packages/cmux/src/convex/convex-bundle/convex-local-backend.zip`;

  // Make the binary executable
  await $`chmod +x ./packages/cmux/src/convex/convex-bundle/convex-local-backend`;
  console.log("Downloaded convex-local-backend.");
} else {
  console.log("convex-local-backend already exists.");
}

// Build the client with the correct VITE_CONVEX_URL
console.log("Building convex cli...");
await $`bun build ./packages/cmux/node_modules/convex/dist/cli.bundle.cjs --outdir ./packages/cmux/src/convex/convex-bundle/convex-cli-dist --target bun --minify`;

console.log("Building client app...");
await $`cd ./apps/client && VITE_CONVEX_URL=http://localhost:9777 bun run build`;

await $`cp -r ./apps/client/dist ./packages/cmux/public`;

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

// Handle process errors
convexBackendProcess.on("error", (error) => {
  console.error("Failed to start convex backend:", error);
  process.exit(1);
});

// Log stderr output
convexBackendProcess.stderr?.on("data", (data) => {
  console.error("Convex backend stderr:", data.toString());
});

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

console.log("Preparing convex deployment");

// Copy necessary files for convex deployment
await $`cp -r ./packages/convex/convex ./packages/cmux/src/convex/convex-bundle/`;
await $`cp ./packages/convex/package.json ./packages/cmux/src/convex/convex-bundle/`;
await $`cp ./packages/convex/tsconfig.json ./packages/cmux/src/convex/convex-bundle/`;

// Create .env.local if it doesn't exist or copy it
const envLocalPath = "./packages/convex/.env.local";
if (existsSync(envLocalPath)) {
  await $`cp ${envLocalPath} ./packages/cmux/src/convex/convex-bundle/`;
} else {
  // Create a minimal .env.local for the deployment
  await $`echo "CONVEX_URL=http://localhost:9777" > ./packages/cmux/src/convex/convex-bundle/.env.local`;
}

console.log("Deploying convex");

const convexAdminKey =
  "cmux-dev|017aebe6643f7feb3fe831fbb93a348653c63e5711d2427d1a34b670e3151b0165d86a5ff9";
await $`cd ./packages/cmux/src/convex/convex-bundle && bunx convex@1.26.0-alpha.6 deploy --url http://localhost:9777 --admin-key ${convexAdminKey}`;

console.log("Killing convex backend");
convexBackendProcess.kill();

// Wait a moment for the database to be fully written
await new Promise((resolve) => setTimeout(resolve, 1000));

// Create a temp directory for the cmux bundle
await $`mkdir -p /tmp/cmux-bundle`;

// Copy convex-bundle contents
await $`cp -r ./packages/cmux/src/convex/convex-bundle/* /tmp/cmux-bundle/`;

// Copy the SQLite database from the convex-bundle directory (which now has the deployed functions)
await $`cp ./packages/cmux/src/convex/convex-bundle/convex_local_backend.sqlite3 /tmp/cmux-bundle/`;

// Copy the convex_local_storage directory
await $`cp -r ./packages/cmux/src/convex/convex-bundle/convex_local_storage /tmp/cmux-bundle/`;

// Copy the correct package.json from cmux package (overwrite the convex one)
await $`cp ./packages/cmux/package.json /tmp/cmux-bundle/`;

// Copy public files (client dist)
await $`mkdir -p /tmp/cmux-bundle/public`;
await $`cp -r ./apps/client/dist /tmp/cmux-bundle/public/`;

// Create the cmux-bundle.zip
await $`cd /tmp && zip -r cmux-bundle.zip cmux-bundle`;
await $`mv /tmp/cmux-bundle.zip ./packages/cmux/src/convex/`;

// Clean up temp directory
await $`rm -rf /tmp/cmux-bundle`;

const VERSION = cmuxPackageJson.version;

// bun build the cli
await $`bun build ./packages/cmux/src/cli.ts --compile --define VERSION="\"${VERSION}\"" --define process.env.WORKER_IMAGE_NAME=lawrencecchen/cmux@latest --define process.env.NODE_ENV="\"production\"" --outfile cmux-cli`;
console.log("Built cmux-cli");

// exit with 0
process.exit(0);
