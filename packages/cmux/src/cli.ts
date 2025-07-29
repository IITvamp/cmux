import { startServer } from "@cmux/server";
import { Command } from "commander";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type ConvexProcesses, spawnConvex } from "./convex/spawnConvex";
import { logger } from "./logger";
import { checkPorts } from "./utils/checkPorts";
import { killPortsIfNeeded } from "./utils/killPortsIfNeeded";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const convexDir = path.resolve(homedir(), ".cmux");

// When running as a compiled binary, __dirname might be in a virtual filesystem
// Check if we're in a bundled environment
const isBundled = __dirname.includes("/$bunfs/");

let staticDir: string;
if (isBundled) {
  // In bundled mode, always use the extracted files from ~/.cmux
  staticDir = path.resolve(convexDir, "public", "dist");
} else {
  // In development mode, use the normal path
  staticDir = path.resolve(__dirname, "..", "public", "dist");
}

const program = new Command();

declare const VERSION: string;

program
  .name("cmux")
  .description("Socket.IO and static file server")
  .version(VERSION)
  .option("-p, --port <port>", "port to listen on", "9776")
  .option("-c, --cors <origin>", "CORS origin configuration", "true")
  .option(
    "--no-autokill-ports",
    "disable automatic killing of processes on required ports"
  )
  .action(async (options) => {
    // Pleasant startup message
    const versionPadding = " ".repeat(
      Math.max(0, 14 - VERSION.toString().length)
    );
    console.log("\n\x1b[36m╔══════════════════════════════════════╗\x1b[0m");
    console.log(
      `\x1b[36m║      Welcome to \x1b[1m\x1b[37mcmux\x1b[0m\x1b[36m v${VERSION}!${versionPadding}║\x1b[0m`
    );
    console.log("\x1b[36m╚══════════════════════════════════════╝\x1b[0m\n");
    console.log("\x1b[32m✓\x1b[0m Server starting...");

    // Pull Docker image asynchronously if WORKER_IMAGE_NAME is set
    if (process.env.WORKER_IMAGE_NAME) {
      console.log(`\x1b[32m✓\x1b[0m Docker image pull initiated: ${process.env.WORKER_IMAGE_NAME}`);
      
      const pullProcess = spawn("docker", ["pull", process.env.WORKER_IMAGE_NAME]);
      
      pullProcess.stdout.on("data", (data) => {
        process.stdout.write(`\x1b[90m[Docker] ${data}\x1b[0m`);
      });
      
      pullProcess.stderr.on("data", (data) => {
        process.stderr.write(`\x1b[33m[Docker] ${data}\x1b[0m`);
      });
      
      pullProcess.on("close", (code) => {
        if (code === 0) {
          console.log(`\x1b[32m✓\x1b[0m Docker image ${process.env.WORKER_IMAGE_NAME} pulled successfully`);
        } else {
          console.log(`\x1b[33m!\x1b[0m Docker image pull failed with code ${code} - image might be available locally`);
        }
      });
      
      pullProcess.on("error", (error) => {
        console.error(`\x1b[31m✗\x1b[0m Failed to start Docker pull:`, error.message);
      });
    }

    const port = parseInt(options.port);

    const portsToCheck = [port, 9777, 9778];
    if (options.autokillPorts) {
      await killPortsIfNeeded(portsToCheck);
    } else {
      // Manual check without killing
      const portsInUse = await checkPorts(portsToCheck);
      if (portsInUse.length > 0) {
        console.error("\x1b[31m✗\x1b[0m Ports already in use:");
        console.error(portsInUse.map((p) => `  - ${p}`).join("\n"));
        console.log(
          "\nYou can either:\n" +
            "  1. Run with default behavior to auto-kill: \x1b[36mcmux\x1b[0m\n" +
            "  2. Manually kill the processes: \x1b[90m" +
            `for p in ${portsInUse.join(" ")}; do lsof -ti :$p | xargs -r kill -9; done\x1b[0m`
        );
        process.exit(1);
      }
    }

    // ensure convexDir exists
    mkdirSync(convexDir, { recursive: true });

    // ensure logs directory exists
    const logsDir = path.join(convexDir, "logs");
    mkdirSync(logsDir, { recursive: true });

    const logFileNames = ["cmux-cli.log", "docker-vscode.log", "server.log"];
    // ensure all log files exist
    for (const logFileName of logFileNames) {
      const logFilePath = path.join(convexDir, "logs", logFileName);
      if (!existsSync(logFilePath)) {
        writeFileSync(logFilePath, "");
      }
    }

    // Check if convex directory exists
    if (!existsSync(convexDir)) {
      console.error("Convex directory not found at:", convexDir);
      process.exit(1);
    }

    logger.ensureLogDirectory();

    let convexProcesses: ConvexProcesses;
    try {
      // Start Convex and wait for it to be ready
      convexProcesses = await spawnConvex(convexDir);
      await logger.info("Convex is ready!");
    } catch (error) {
      await logger.error(`Failed to start Convex: ${error}`);
      console.error("Failed to start Convex:", error);
      process.exit(1);
    }

    // Check if static directory exists
    if (!existsSync(staticDir)) {
      console.error(`Static directory not found at: ${staticDir}`);
      console.error("This should have been extracted automatically.");
      console.error("Try deleting ~/.cmux and running the CLI again.");
      process.exit(1);
    }

    console.log(
      "\x1b[32m✓\x1b[0m Link: \x1b[36mhttp://localhost:" + port + "\x1b[0m\n"
    );

    await logger.info(`Starting server on port ${port}...`);
    await logger.info(`Serving static files from: ${staticDir}`);
    const startServerProcessPromise = startServer({
      port,
      publicPath: staticDir,
    });

    // Cleanup processes on exit
    const cleanup = async () => {
      const startServerProcess = await startServerProcessPromise;
      console.log("\n\x1b[33mShutting down server...\x1b[0m");
      logger.info("Shutting down server...");
      const cleanupPromise = startServerProcess.cleanup();
      convexProcesses.backend.kill();
      await cleanupPromise;
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  });

program
  .command("uninstall")
  .description("Remove cmux data and show uninstall instructions")
  .action(async () => {
    console.log("\n\x1b[33m🗑️  Uninstalling cmux...\x1b[0m\n");

    // Remove ~/.cmux directory
    if (existsSync(convexDir)) {
      try {
        console.log(`Removing data directory: ${convexDir}`);
        rmSync(convexDir, { recursive: true, force: true });
        console.log("\x1b[32m✓\x1b[0m Data directory removed successfully");
      } catch (error) {
        console.error(
          "\x1b[31m✗\x1b[0m Failed to remove data directory:",
          error
        );
      }
    } else {
      console.log("\x1b[33m!\x1b[0m Data directory not found, skipping...");
    }

    // Show uninstall instructions based on how it might have been installed
    console.log("\n\x1b[36mTo complete the uninstallation:\x1b[0m\n");

    console.log("If installed globally with npm:");
    console.log("  \x1b[90mnpm uninstall -g cmux\x1b[0m\n");

    console.log("If installed globally with yarn:");
    console.log("  \x1b[90myarn global remove cmux\x1b[0m\n");

    console.log("If installed globally with pnpm:");
    console.log("  \x1b[90mpnpm uninstall -g cmux\x1b[0m\n");

    console.log("If installed globally with bun:");
    console.log("  \x1b[90mbun uninstall -g cmux\x1b[0m\n");

    console.log("\x1b[32m✓\x1b[0m cmux data has been removed!");
    process.exit(0);
  });

program.parse();
