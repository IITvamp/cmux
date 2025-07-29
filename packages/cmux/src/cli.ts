import { startServer } from "@cmux/server";
import { Command } from "commander";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type ConvexProcesses, spawnConvex } from "./convex/spawnConvex";
import { logger } from "./logger";
import { checkPorts } from "./utils/checkPorts";

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
  .action(async (options) => {
    // Check if static directory exists
    if (!existsSync(staticDir)) {
      console.error(`Static directory not found at: ${staticDir}`);
      console.error("This should have been extracted automatically.");
      console.error("Try deleting ~/.cmux and running the CLI again.");
      process.exit(1);
    }

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

    const port = parseInt(options.port);

    const portsToCheck = [port, 9777, 9778];
    const portsInUse = await checkPorts(portsToCheck);
    if (portsInUse.length > 0) {
      console.error("Please kill the processes running on the ports:");
      console.error(portsInUse.map((p) => `- ${p}`).join("\n"));
      console.log(
        "You can use the following command to kill the processes:\n" +
          `for p in ${portsInUse.join(" ")}; do lsof -ti :$p | xargs -r kill -9; done`
      );
      process.exit(1);
    }

    // ensure convexDir exists
    mkdirSync(convexDir, { recursive: true });

    // Check if convex directory exists
    if (!existsSync(convexDir)) {
      console.error("Convex directory not found at:", convexDir);
      process.exit(1);
    }

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

    console.log(
      "\x1b[32m✓\x1b[0m Link: \x1b[36mhttp://localhost:" + port + "\x1b[0m\n"
    );

    await logger.info(`Starting server on port ${port}...`);
    await logger.info(`Serving static files from: ${staticDir}`);
    void startServer({
      port,
      publicPath: staticDir,
    });

    // Cleanup processes on exit
    const cleanup = () => {
      console.log("\n\x1b[33mShutting down server...\x1b[0m");
      logger.info("Shutting down server...").catch(() => {});
      convexProcesses.backend.kill();
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  });

program.parse();
