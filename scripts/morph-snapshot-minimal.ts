#!/usr/bin/env tsx
import dotenv from "dotenv";
import fs from "fs/promises";
import { MorphCloudClient } from "morphcloud";
import path from "path";
import { fileURLToPath } from "url";
import { DockerfileParser, DockerfileExecutor } from "./dockerfile-parser.js";

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.join(__dirname, "..", ".env");
const scriptsEnvPath = path.join(__dirname, ".env");
dotenv.config({ path: (await fs.stat(rootEnvPath).then(() => rootEnvPath).catch(() => scriptsEnvPath)) });

async function main() {
  try {
    const client = new MorphCloudClient();
    
    // Configuration
    const VCPUS = 4;
    const MEMORY = 8192;
    const DISK_SIZE = 16384;
    
    console.log("Creating initial snapshot from morphvm-minimal...");
    const initialSnapshot = await client.snapshots.create({
      imageId: "morphvm-minimal",
      vcpus: VCPUS,
      memory: MEMORY,
      diskSize: DISK_SIZE,
    });
    
    console.log(`Starting instance from snapshot ${initialSnapshot.id}...`);
    const instance = await client.instances.start({
      snapshotId: initialSnapshot.id,
    });
    
    // Wait for instance to be ready
    await instance.waitUntilReady();
    
    try {
      // Parse and execute Dockerfile
      const projectRoot = path.join(__dirname, "..");
      const dockerfilePath = path.join(projectRoot, "Dockerfile");
      
      console.log("\n--- Parsing Dockerfile ---");
      const parser = new DockerfileParser(dockerfilePath, projectRoot);
      const parsedDockerfile = await parser.parse(dockerfilePath);
      console.log(`Parsed ${parsedDockerfile.instructions.length} instructions from Dockerfile`);
      
      console.log("\n--- Executing Dockerfile instructions ---");
      const executor = new DockerfileExecutor(instance, projectRoot);
      await executor.execute(parsedDockerfile);
      
      // Create final snapshot
      console.log("\n--- Creating final snapshot ---");
      const finalSnapshot = await instance.snapshot({
        metadata: {
          name: `cmux-worker-minimal-${Date.now()}`,
          description: "cmux worker built minimally from Dockerfile",
        },
      });
      
      console.log(`\n✅ Successfully created snapshot: ${finalSnapshot.id}`);
      console.log("\nTo use this snapshot:");
      console.log(
        `  const instance = await client.instances.start({ snapshotId: "${finalSnapshot.id}" });`
      );
      
      // Display instance information
      console.log("\nInstance Details:");
      console.log(`  ID: ${instance.id}`);
      console.log(`  Snapshot ID: ${finalSnapshot.id}`);
    } finally {
      // Stop the instance
      console.log("\nStopping instance...");
      await instance.stop();
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Run the main function
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});