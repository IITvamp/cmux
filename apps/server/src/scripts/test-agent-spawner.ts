#!/usr/bin/env tsx
import { api } from "@coderouter/convex/api";
import { AGENT_CONFIGS } from "@coderouter/shared/agentConfig";
import { spawnAgent } from "../agentSpawner.js";
import { convex } from "../utils/convexClient.js";
import { VSCodeInstance } from "../vscode/VSCodeInstance.js";

async function main() {
  console.log("=== Testing Agent Spawner ===\n");

  // Create a map to store VSCode instances
  const vscodeInstances = new Map<string, VSCodeInstance>();

  // Find claude-sonnet agent config
  const agentConfig = AGENT_CONFIGS.find(
    (agent) => agent.name === "claude-sonnet"
  );
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
      console.log("\nWaiting 10 seconds to observe terminal behavior...");

      // Wait for 10 seconds
      await new Promise((resolve) => setTimeout(resolve, 10000));

      console.log("\n\nChecking if terminal is still running...");

      // Check container and tmux status
      const containerId = result.vscodeUrl?.match(/localhost:(\d+)/)?.[1];
      if (containerId) {
        try {
          const { execSync } = await import("child_process");
          // Find container by partial name match
          const findCmd = `docker ps -a --format "{{.ID}} {{.Names}}" | grep coderouter-vscode | head -1 | awk '{print $1}'`;
          const dockerId = execSync(findCmd).toString().trim();

          if (dockerId) {
            console.log(`\nContainer ID: ${dockerId}`);

            // Check tmux sessions
            const tmuxList = execSync(
              `docker exec ${dockerId} tmux ls 2>&1 || echo "No sessions"`
            ).toString();
            console.log(`Tmux sessions: ${tmuxList.trim()}`);

            // Check if specific session exists
            const sessionExists = tmuxList.includes(
              result.terminalId.slice(-8)
            );
            console.log(`Terminal session exists: ${sessionExists}`);
          }
        } catch (e) {
          if (e instanceof Error) {
            console.log("Could not check container status:", e.message);
          } else {
            console.log("Could not check container status:", e);
          }
        }
      }

      console.log("\nShutting down...");

      // Stop all VSCode instances
      for (const [id, instance] of vscodeInstances) {
        console.log(`Stopping VSCode instance ${id}...`);
        await instance.stop();
      }

      process.exit(0);
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
