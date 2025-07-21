#!/usr/bin/env tsx
import { AGENT_CONFIGS } from "@coderouter/shared/agentConfig";
import { api } from "@coderouter/convex/api";
import { spawnAgent } from "../agentSpawner.js";
import { convex } from "../utils/convexClient.js";
import { VSCodeInstance } from "../vscode/VSCodeInstance.js";

async function main() {
  console.log("=== Testing Agent Spawner ===\n");

  // Create a map to store VSCode instances
  const vscodeInstances = new Map<string, VSCodeInstance>();

  // Find claude-sonnet agent config
  const agentConfig = AGENT_CONFIGS.find(agent => agent.name === "claude-sonnet");
  if (!agentConfig) {
    console.error("Could not find claude-sonnet agent config");
    process.exit(1);
  }

  console.log("Agent config:", {
    name: agentConfig.name,
    command: agentConfig.command,
    args: agentConfig.args,
  });

  // Test parameters
  const testOptions = {
    repoUrl: "https://github.com/lawrencecchen/coderouter.git",
    branch: "main",
    taskDescription: "what's the time",
    isCloudMode: false,
  };

  console.log("\nTest options:", testOptions);

  // Create a task in Convex first
  console.log("\nCreating task in Convex...");
  const taskId = await convex.mutation(api.tasks.create, {
    projectFullName: "lawrencecchen/coderouter",
    text: testOptions.taskDescription,
  });
  console.log(`Created task: ${taskId}`);

  console.log("\n--- Starting agent spawn ---\n");

  try {
    const result = await spawnAgent(
      agentConfig,
      taskId,
      vscodeInstances,
      testOptions
    );

    console.log("\n--- Agent spawn result ---");
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log("\n✅ Agent spawned successfully!");
      console.log(`VSCode URL: ${result.vscodeUrl}`);
      console.log(`Terminal ID: ${result.terminalId}`);
      
      // Keep process alive to observe
      console.log("\nPress Ctrl+C to exit...");
      
      // Wait for Ctrl+C
      process.on('SIGINT', async () => {
        console.log("\n\nShutting down...");
        
        // Stop all VSCode instances
        for (const [id, instance] of vscodeInstances) {
          console.log(`Stopping VSCode instance ${id}...`);
          await instance.stop();
        }
        
        process.exit(0);
      });
      
      // Keep the process running
      await new Promise(() => {});
    } else {
      console.error("\n❌ Agent spawn failed!");
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Unexpected error:", error);
    process.exit(1);
  }
}

main().catch(console.error);