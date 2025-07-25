import { $ } from "bun";
import * as convex from "convex";
import { ChildProcess, spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// @ts-expect-error this is a real file!
import cmux_bundle_zip from "./cmux-bundle.zip" with { type: "file" };

// console.log(embeddedFiles);
console.log("convex", convex);

export interface ConvexProcesses {
  backend: ChildProcess;
}

export async function spawnConvex(
  convexDir?: string
): Promise<ConvexProcesses> {
  if (!convexDir) {
    convexDir = path.resolve(os.homedir(), ".cmux");
  }
  const convexPort = process.env.CONVEX_PORT || "9777";

  console.log("Starting Convex CLI...");
  console.log(`Creating directory: ${convexDir}`);
  const dirStartTime = performance.now();
  await fs.mkdir(convexDir, { recursive: true });
  const dirEndTime = performance.now();
  console.log(
    `Directory creation took ${(dirEndTime - dirStartTime).toFixed(2)}ms`
  );

  console.log("Extracting cmux bundle...");
  
  // Check if bundle already exists by checking for a key file
  const convexBinaryPath = path.resolve(convexDir, "convex-local-backend");
  const bundleExists = await fs.access(convexBinaryPath).then(() => true).catch(() => false);
  
  if (bundleExists) {
    console.log("Cmux bundle already exists, skipping extraction");
  } else {
    // Write the zip file to a temporary location and extract it
    const tempZipPath = path.join(os.tmpdir(), `cmux-bundle-${Date.now()}.zip`);
    
    // Read the embedded zip file and write it to disk
    const zipData = await fs.readFile(cmux_bundle_zip);
    await fs.writeFile(tempZipPath, zipData);
    
    const unzipStartTime = performance.now();
    // Extract to temp directory first
    const tempExtractDir = path.join(os.tmpdir(), `cmux-extract-${Date.now()}`);
    await $`unzip -o ${tempZipPath} -d ${tempExtractDir}`;
    
    // Clear the convexDir and move the contents of cmux-bundle
    await fs.rm(convexDir, { recursive: true, force: true });
    await fs.mkdir(convexDir, { recursive: true });
    await $`mv ${tempExtractDir}/cmux-bundle/* ${convexDir}/`;
    
    // Cleanup
    await $`rm -rf ${tempExtractDir}`;
    await fs.unlink(tempZipPath);
    
    const unzipEndTime = performance.now();
    console.log(`Unzip took ${(unzipEndTime - unzipStartTime).toFixed(2)}ms`);
  }

  // Make sure the binary is executable
  try {
    await fs.chmod(convexBinaryPath, 0o755);
  } catch (error) {
    console.error(`Failed to make binary executable: ${error}`);
  }

  console.log("Starting convex process...");
  const convexBackend = spawn(
    convexBinaryPath,
    [
      "--port",
      convexPort,
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
      cwd: convexDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    }
  );

  convexBackend.stdout.on("data", (data) => {
    process.stdout.write(`[CONVEX-BACKEND] ${data}`);
  });

  convexBackend.stderr.on("data", (data) => {
    process.stderr.write(`[CONVEX-BACKEND] ${data}`);
  });

  // wait until we can fetch the instance
  let instance: Response | undefined;
  let retries = 0;
  const maxRetries = 100;

  while ((!instance || !instance.ok) && retries < maxRetries) {
    try {
      instance = await fetch(`http://localhost:${convexPort}/`);
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

  return {
    backend: convexBackend,
  };
}
