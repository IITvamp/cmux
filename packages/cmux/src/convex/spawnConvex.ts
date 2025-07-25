import { file } from "bun";
import { ChildProcess, spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
// @ts-expect-error this is a real file!
import convex_local_backend from "./convex-local-backend" with { type: "file" };

// console.log(embeddedFiles);

export interface ConvexProcesses {
  backend: ChildProcess;
}

export async function spawnConvex(
  convexDir?: string
): Promise<ConvexProcesses> {
  if (!convexDir) {
    convexDir = path.resolve(os.homedir(), ".cmux", "data");
  }
  const convexPort = process.env.CONVEX_PORT || "9777";

  console.log("Starting Convex CLI...");
  console.log(convex_local_backend);
  console.log(`Creating directory: ${convexDir}`);
  const dirStartTime = performance.now();
  await fs.mkdir(convexDir, { recursive: true });
  const dirEndTime = performance.now();
  console.log(
    `Directory creation took ${(dirEndTime - dirStartTime).toFixed(2)}ms`
  );

  console.log("Reading convex binary file...");
  const fileReadStartTime = performance.now();
  const convexBinaryBlob = file(convex_local_backend);
  const fileReadEndTime = performance.now();
  console.log(
    `File read took ${(fileReadEndTime - fileReadStartTime).toFixed(2)}ms`
  );

  const convexBinaryPath = path.resolve(convexDir, "convex-local-backend");

  try {
    await fs.access(convexBinaryPath);
    console.log(
      `Binary already exists at: ${convexBinaryPath}, skipping write`
    );
  } catch {
    console.log(`Writing binary to: ${convexBinaryPath}`);
    const writeStartTime = performance.now();
    const arrayBuffer = await convexBinaryBlob.arrayBuffer();
    await fs.writeFile(convexBinaryPath, Buffer.from(arrayBuffer), {
      mode: 0o755,
    });
    const writeEndTime = performance.now();
    console.log(
      `Binary write took ${(writeEndTime - writeStartTime).toFixed(2)}ms`
    );
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
      instance = await fetch(`http://localhost:${convexPort}/api/instance`);
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
