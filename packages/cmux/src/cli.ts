import { startServer } from "@coderouter/server";
import { Command } from "commander";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type ConvexProcesses, spawnConvex } from "./convex/spawnConvex";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticDir = path.resolve(__dirname, "..", "public/dist");
const convexDir = path.resolve(homedir(), ".cmux", "data");

const program = new Command();

program
  .name("cmux")
  .description("Socket.IO and static file server")
  .version("0.1.1")
  .option("-p, --port <port>", "port to listen on", "9776")
  .option("-c, --cors <origin>", "CORS origin configuration", "true")
  .action(async (options) => {
    const port = parseInt(options.port);

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
      console.log("Convex is ready!");
    } catch (error) {
      console.error("Failed to start Convex:", error);
      process.exit(1);
    }

    // Start the main server
    const START_SERVER = false;
    if (START_SERVER) {
      console.log(`Starting server on port ${port}...`);
      void startServer({
        port,
        publicPath: staticDir,
      });
    }

    // Cleanup processes on exit
    const cleanup = () => {
      console.log("\nShutting down server...");
      convexProcesses.backend.kill();
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  });

program.parse();
