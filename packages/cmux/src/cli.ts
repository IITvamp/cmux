import { startServer } from "@coderouter/server";
import { Command } from "commander";
import { fileURLToPath } from "node:url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const program = new Command();

program
  .name("cmux")
  .description("Socket.IO and static file server")
  .version("0.1.1")
  .option("-p, --port <port>", "port to listen on", "3001")
  .option("-c, --cors <origin>", "CORS origin configuration", "true")
  .action((options) => {
    const port = parseInt(options.port);
    const staticDir = path.resolve(__dirname, "..", "public/dist");

    // first, we start convex

    startServer({
      port,
      publicPath: staticDir,
    });

    process.on("SIGINT", () => {
      console.log("\nShutting down server...");
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      console.log("\nShutting down server...");
      process.exit(0);
    });
  });

program.parse();
