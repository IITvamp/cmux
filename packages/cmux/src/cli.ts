import { startServer } from "@coderouter/server";
import { Command } from "commander";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type ConvexProcesses, spawnConvex } from "./convex/spawnConvex";

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

program
  .name("cmux")
  .description("Socket.IO and static file server")
  .version("0.2.5")
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
    const START_SERVER = true;
    if (START_SERVER) {
      // Check if static directory exists
      if (!existsSync(staticDir)) {
        console.error(`Static directory not found at: ${staticDir}`);
        console.error("This should have been extracted automatically.");
        console.error("Try deleting ~/.cmux and running the CLI again.");
        process.exit(1);
      }
      
      console.log(`Starting server on port ${port}...`);
      console.log(`Serving static files from: ${staticDir}`);
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
