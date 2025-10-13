#!/usr/bin/env bun
/**
 * Test script for auto-preview functionality
 *
 * This script tests the port monitoring and Chrome CDP integration
 * without requiring a full worker setup.
 *
 * Usage:
 *   bun run apps/worker/test-auto-preview.ts
 */

import { PortMonitor, analyzePort } from "./src/portMonitor";
import { ChromePreviewClient, AutoPreviewManager } from "./src/chromePreview";

async function testPortScanning() {
  console.log("=== Testing Port Scanning ===\n");

  const monitor = new PortMonitor(
    (port, heuristics) => {
      console.log(`Detected port: ${port.port}`);
      console.log(`  Process: ${port.processName} (PID: ${port.pid})`);
      console.log(`  Framework: ${heuristics.framework || "unknown"}`);
      console.log(`  Likely dev server: ${heuristics.likelyDevServer}`);
      console.log(`  Process name match: ${heuristics.processNameMatch}`);
      console.log();
    },
    {
      scanIntervalMs: 3000,
      minPort: 3000,
      maxPort: 9999,
      filterByHeuristics: false, // Show all ports for testing
    }
  );

  console.log("Starting port monitor...");
  console.log("Scanning ports 3000-9999 every 3 seconds");
  console.log("Try starting a dev server (e.g., 'npm run dev' in a project)\n");

  monitor.start();

  // Run for 30 seconds
  await new Promise((resolve) => setTimeout(resolve, 30000));

  console.log("\nStopping port monitor...");
  monitor.stop();

  const knownPorts = monitor.getKnownPorts();
  console.log(`\nDetected ${knownPorts.size} port(s): ${Array.from(knownPorts).join(", ")}`);
}

async function testChromeCDP() {
  console.log("\n=== Testing Chrome CDP ===\n");

  const client = new ChromePreviewClient({
    cdpHost: "127.0.0.1",
    cdpPort: 39381,
  });

  // Check if Chrome is available
  console.log("Checking if Chrome CDP is available...");
  const available = await client.isAvailable();

  if (!available) {
    console.log("❌ Chrome CDP is not available");
    console.log("Make sure Chrome is running with:");
    console.log("  --remote-debugging-address=127.0.0.1");
    console.log("  --remote-debugging-port=39381");
    return false;
  }

  console.log("✅ Chrome CDP is available\n");

  // List current tabs
  console.log("Current tabs:");
  const targets = await client.listTargets();
  for (const target of targets) {
    console.log(`  - ${target.title} (${target.url})`);
  }
  console.log();

  // Test creating a tab
  console.log("Creating a test tab...");
  const testTab = await client.createTab("https://example.com");

  if (testTab) {
    console.log(`✅ Created tab: ${testTab.id}`);
    console.log(`   URL: ${testTab.url}\n`);

    // Wait a moment
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Close the test tab
    console.log("Closing test tab...");
    const closed = await client.closeTab(testTab.id);
    console.log(closed ? "✅ Tab closed" : "❌ Failed to close tab");
  } else {
    console.log("❌ Failed to create tab");
  }

  return true;
}

async function testAutoPreview() {
  console.log("\n=== Testing Auto-Preview Integration ===\n");

  const manager = new AutoPreviewManager({
    cdpHost: "127.0.0.1",
    cdpPort: 39381,
    localHost: "localhost",
    requireLikelyDevServer: true,
  });

  // Enable auto-preview
  console.log("Enabling auto-preview...");
  const enabled = await manager.enable();

  if (!enabled) {
    console.log("❌ Failed to enable auto-preview (Chrome CDP not available)");
    return;
  }

  console.log("✅ Auto-preview enabled\n");

  console.log("Simulating detection of a Vite dev server on port 5173...");

  // Simulate a detected port
  const fakePort = {
    port: 5173,
    processName: "vite",
    pid: 12345,
    timestamp: Date.now(),
  };

  const heuristics = analyzePort(fakePort);

  console.log("Port analysis:");
  console.log(`  Port: ${fakePort.port}`);
  console.log(`  Process: ${fakePort.processName}`);
  console.log(`  Framework: ${heuristics.framework}`);
  console.log(`  Likely dev server: ${heuristics.likelyDevServer}`);
  console.log(`  Process name match: ${heuristics.processNameMatch}\n`);

  // This would normally happen automatically when port monitor detects a new port
  console.log("Opening preview in Chrome...");
  await manager.handleNewPort(fakePort, heuristics);

  console.log("\nCheck Chrome for a new tab pointing to http://localhost:5173");
  console.log("(The page won't load unless you actually have a server on that port)\n");

  // Disable auto-preview
  console.log("Disabling auto-preview...");
  manager.disable();
  console.log("✅ Auto-preview disabled");
}

async function main() {
  console.log("Auto-Preview Test Script\n");
  console.log("This script will test the auto-preview functionality");
  console.log("including port scanning and Chrome CDP integration.\n");

  // Test 1: Port scanning
  await testPortScanning();

  // Test 2: Chrome CDP
  const chromeAvailable = await testChromeCDP();

  // Test 3: Auto-preview integration (only if Chrome is available)
  if (chromeAvailable) {
    await testAutoPreview();
  }

  console.log("\n=== Tests Complete ===\n");
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
