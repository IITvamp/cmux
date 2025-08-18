#!/usr/bin/env tsx
import dotenv from "dotenv";
import fs from "fs/promises";
import { MorphCloudClient } from "morphcloud";
import type { Instance } from "morphcloud";
import path from "path";
import { fileURLToPath } from "url";
import { DockerfileParser, DockerfileExecutor, type DockerfileExecutionResult } from "./dockerfile-parser.js";

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.join(__dirname, "..", ".env");
const scriptsEnvPath = path.join(__dirname, ".env");
dotenv.config({ path: (await fs.stat(rootEnvPath).then(() => rootEnvPath).catch(() => scriptsEnvPath)) });

async function startServicesAndWait(instance: Instance, result: DockerfileExecutionResult): Promise<void> {
  console.log(`\n==> Starting services for snapshot...`);
  
  // Parse and combine ENTRYPOINT and CMD
  const parseDockerCommand = (command: string): string => {
    if (command.startsWith("[") && command.endsWith("]")) {
      try {
        const parsed = JSON.parse(command);
        return parsed.join(" ");
      } catch (e) {
        return command;
      }
    }
    return command;
  };
  
  let startupCommand = "";
  if (result.entrypoint) {
    startupCommand = parseDockerCommand(result.entrypoint);
  }
  if (result.cmd) {
    const cmd = parseDockerCommand(result.cmd);
    startupCommand = startupCommand ? `${startupCommand} ${cmd}` : cmd;
  }
  
  if (!startupCommand) {
    console.log("  No startup command to execute");
    return;
  }
  
  console.log(`  Starting: ${startupCommand}`);
  
  // Start the services in the background
  const fullCommand = `nohup ${startupCommand} > /var/log/startup.log 2>&1 &`;
  await instance.exec(fullCommand);
  
  // Wait for services to be ready
  console.log("  Waiting for services to be ready...");
  
  const maxWaitTime = 60000; // 60 seconds max
  const checkInterval = 2000; // Check every 2 seconds
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    // Check if exposed ports are listening
    let portsReady = true;
    if (result.exposedPorts.length > 0) {
      const portsToCheck = result.exposedPorts.map(p => p.port).join("|");
      const checkResult = await instance.exec(
        `ss -tulnp 2>/dev/null | grep -E ":(${portsToCheck})\\s" | wc -l`
      );
      const listeningCount = parseInt(checkResult.stdout.trim()) || 0;
      portsReady = listeningCount >= result.exposedPorts.length;
    }
    
    if (portsReady) {
      console.log("    ✓ Ports are listening");
      
      // Give it a few more seconds to fully stabilize
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log("    ✓ Services appear ready");
      return;
    }
    
    // Show progress
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    process.stdout.write(`\r    ⏳ Waiting for services... ${elapsed}s`);
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  // Clear the progress line
  process.stdout.write("\r" + " ".repeat(50) + "\r");
  console.log("    ⚠ Timeout waiting for services (continuing anyway)");
}

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
      const result = await executor.execute(parsedDockerfile);
      
      // Start services if ENTRYPOINT/CMD is defined
      if (result.entrypoint || result.cmd) {
        await startServicesAndWait(instance, result);
      }
      
      // Expose ports
      if (result.exposedPorts.length > 0) {
        console.log(`\n==> Exposing ${result.exposedPorts.length} HTTP service(s)...`);
        for (const { port, name } of result.exposedPorts) {
          try {
            const service = await instance.exposeHttpService(name, port);
            console.log(`  ✓ Exposed ${name} on port ${port} -> ${service.url}`);
          } catch (err) {
            console.error(`  ✗ Failed to expose ${name} on port ${port}:`, err);
          }
        }
      }
      
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