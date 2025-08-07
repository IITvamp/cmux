#!/usr/bin/env tsx
/**
 * Quick script to create a debug instance with streaming logs (v2)
 * 
 * Usage:
 *   bun run ./scripts/quick-debug-v2.ts [git-url] [branch]
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

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

async function main() {
  const gitUrl = process.argv[2] || DEFAULT_REPO;
  const branch = process.argv[3] || "main";

  console.log(`${colors.bright}🚀 Creating debug instance with streaming exec logs...${colors.reset}`);
  console.log(`${colors.blue}Repository:${colors.reset} ${gitUrl}`);
  console.log(`${colors.blue}Branch:${colors.reset} ${branch}\n`);

  const morphProvider = await MorphProvider.create();

  // Set base snapshot ID
  const baseSnapshotId = process.env.MORPH_BASE_SNAPSHOT_ID || 'snapshot_7o3z2iez';
  console.log(`${colors.dim}Using base snapshot: ${baseSnapshotId}${colors.reset}\n`);

  // Create log handler with pretty formatting
  const logHandler = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    
    // Color code different types of output
    if (message.includes('[stderr]')) {
      console.log(`${colors.dim}[${timestamp}]${colors.reset} ${colors.red}${message}${colors.reset}`);
    } else if (message.startsWith('[Morph]')) {
      console.log(`${colors.dim}[${timestamp}]${colors.reset} ${colors.cyan}${message}${colors.reset}`);
    } else {
      // Command output - indent it
      console.log(`${colors.dim}  │${colors.reset} ${message.trimEnd()}`);
    }
  };

  try {
    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    
    const preview = await morphProvider.createPreviewEnvironment({
      baseSnapshotId,
      config: {
        gitUrl,
        branch,
        hasDevcontainer: true,
      },
      logHandler
    });

    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`\n${colors.green}${colors.bright}✅ Preview created successfully!${colors.reset}\n`);
    
    console.log(`${colors.bright}🌐 Access URLs:${colors.reset}`);
    console.log(`${colors.blue}VSCode:${colors.reset} ${preview.urls?.vscode || "Not available"}`);
    console.log(`${colors.blue}Worker:${colors.reset} ${preview.urls?.worker || "Not available"}`);
    
    console.log(`\n${colors.bright}📌 Preview Details:${colors.reset}`);
    console.log(`${colors.dim}ID:${colors.reset} ${preview.id}`);
    console.log(`${colors.dim}Status:${colors.reset} ${preview.status}`);
    
    console.log(`\n${colors.yellow}The preview will keep running. To stop it later:${colors.reset}`);
    console.log(`${colors.dim}bun run ./scripts/cleanup-instance.ts ${preview.morphInstanceId || preview.id}${colors.reset}`);
    console.log(`\n${colors.dim}Press Ctrl+C to exit (instance will continue running)${colors.reset}`);

    // Keep script running
    await new Promise(() => {});
  } catch (error) {
    console.error(`\n${colors.red}${colors.bright}❌ Error:${colors.reset}`, error);
    process.exit(1);
  }
}

main().catch(console.error);