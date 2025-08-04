#!/usr/bin/env tsx
/**
 * Quick script to create and open a debug instance
 * 
 * Usage:
 *   bun run ./scripts/quick-debug.ts [git-url] [branch] [snapshot-id]
 * 
 * Examples:
 *   bun run ./scripts/quick-debug.ts
 *   bun run ./scripts/quick-debug.ts https://github.com/user/repo main
 *   bun run ./scripts/quick-debug.ts https://github.com/user/repo main snapshot_custom123
 * 
 * Defaults:
 *   - git-url: https://github.com/microsoft/vscode-remote-try-node
 *   - branch: main
 *   - snapshot-id: $MORPH_BASE_SNAPSHOT_ID or snapshot_7o3z2iez
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { MorphProvider } from "../src/services/morph.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../../../.env") });
dotenv.config({ path: path.join(__dirname, "../.env") });

// Use a simple repo with devcontainer support
const DEFAULT_REPO = "https://github.com/microsoft/vscode-remote-try-node";

async function main() {
  const gitUrl = process.argv[2] || DEFAULT_REPO;
  const branch = process.argv[3] || "main";
  const customSnapshotId = process.argv[4]; // Optional snapshot ID override

  console.log("🚀 Creating debug instance...");
  console.log(`Repository: ${gitUrl}`);
  console.log(`Branch: ${branch}\n`);

  const morphProvider = new MorphProvider();
  
  // Set base snapshot ID: CLI arg > env var > default full snapshot
  const baseSnapshotId = customSnapshotId || process.env.MORPH_BASE_SNAPSHOT_ID || 'snapshot_7o3z2iez';
  morphProvider.setBaseSnapshotId(baseSnapshotId);
  console.log(`Using base snapshot: ${baseSnapshotId}\n`);

  try {
    const preview = await morphProvider.createPreviewEnvironment({
      gitUrl,
      branch,
      hasDevcontainer: true,
    });

    console.log(`✅ Preview created: ${preview.id}\n`);
    console.log("🌐 URLs:");
    console.log(`VSCode: ${preview.urls?.vscode || "Not available"}`);
    console.log(`Worker: ${preview.urls?.worker || "Not available"}`);
    console.log("\n📌 Preview will keep running. To stop it later, use:");
    console.log(`Preview ID: ${preview.id}`);
    console.log("\nPress Ctrl+C to exit (instance will continue running)");

    // Keep script running
    await new Promise(() => {});
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main().catch(console.error);
