import { startServer } from "@coderouter/server";
import { spawn } from "child_process";
import { Command } from "commander";
import { existsSync } from "fs";
import { fileURLToPath } from "node:url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const program = new Command();

program
  .name("cmux")
  .description("Socket.IO and static file server")
  .version("0.1.1")
  .option("-p, --port <port>", "port to listen on", "9776")
  .option("-c, --cors <origin>", "CORS origin configuration", "true")
  .action(async (options) => {
    const port = parseInt(options.port);
    const staticDir = path.resolve(__dirname, "..", "public/dist");
    const convexDir = path.resolve(__dirname, "../../convex");

    // Check if convex directory exists
    if (!existsSync(convexDir)) {
      console.error("Convex directory not found at:", convexDir);
      process.exit(1);
    }

    // Start convex backend
    console.log("Starting Convex backend...");
    const convexBackend = spawn(
      "./convex-local-backend",
      [
        "--port",
        process.env.CONVEX_PORT || "9777",
        "--site-proxy-port",
        process.env.CONVEX_SITE_PROXY_PORT || "9778",
        "--instance-name",
        process.env.CONVEX_INSTANCE_NAME || "cmux-dev",
        "--instance-secret",
        process.env.CONVEX_INSTANCE_SECRET ||
          "29dd272e3cd3cce53ff444cac387925c2f6f53fd9f50803a24e5a11832d36b9c",
        "--disable-beacon",
      ],
      {
        cwd: convexDir,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env },
      }
    );

    convexBackend.stdout.on("data", (data) => {
      process.stdout.write(`[CONVEX-BACKEND] ${data}`);
    });

    convexBackend.stderr.on("data", (data) => {
      process.stderr.write(`[CONVEX-BACKEND] ${data}`);
    });

    // Start convex dev
    console.log("Starting Convex dev...");
    const convexDev = spawn(
      "bunx",
      ["convex", "dev", "--env-file", ".env.local"],
      {
        cwd: convexDir,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env },
      }
    );

    convexDev.stdout.on("data", (data) => {
      process.stdout.write(`[CONVEX-DEV] ${data}`);
    });

    convexDev.stderr.on("data", (data) => {
      process.stderr.write(`[CONVEX-DEV] ${data}`);
    });

    // Wait a bit for convex to start
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Start the main server
    console.log(`Starting server on port ${port}...`);
    startServer({
      port,
      publicPath: staticDir,
    });

    // Cleanup processes on exit
    const cleanup = () => {
      console.log("\nShutting down server...");
      convexBackend.kill();
      convexDev.kill();
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  });

program.parse();
