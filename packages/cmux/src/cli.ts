import { startServer } from "@coderouter/server";
import { Command } from "commander";
import { ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const convexBinaryPath = path.resolve(
  __dirname,
  "../../convex/convex-local-backend"
);
const staticDir = path.resolve(__dirname, "..", "public/dist");
const convexDir = path.resolve(homedir(), ".cmux", "data");

interface ConvexProcesses {
  backend: ChildProcess;
}

async function startConvex(convexDir: string): Promise<ConvexProcesses> {
  return new Promise(async (resolve, reject) => {
    // Start convex backend
    console.log("Starting Convex backend...");
    const convexPort = process.env.CONVEX_PORT || "9777";
    const convexBackend = spawn(
      convexBinaryPath,
      [
        "--port",
        convexPort,
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

    convexBackend.on("error", (err) => {
      reject(new Error(`Failed to start Convex backend: ${err.message}`));
    });

    // wait until we can fetch the instance
    let instance: Response | undefined;
    let retries = 0;
    const maxRetries = 30;

    while ((!instance || !instance.ok) && retries < maxRetries) {
      try {
        instance = await fetch(`http://localhost:${convexPort}/api/instance`);
      } catch (error) {
        // Ignore fetch errors and continue retrying
      }

      if (!instance || !instance.ok) {
        retries++;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    if (!instance || !instance.ok) {
      throw new Error(
        `Failed to connect to Convex instance after ${maxRetries} retries`
      );
    }

    resolve({ backend: convexBackend });
  });
}

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

    // Start the main server
    console.log(`Starting server on port ${port}...`);
    void startServer({
      port,
      publicPath: staticDir,
    });

    let convexProcesses: ConvexProcesses;
    try {
      // Start Convex and wait for it to be ready
      convexProcesses = await startConvex(convexDir);
      console.log("Convex is ready!");
    } catch (error) {
      console.error("Failed to start Convex:", error);
      process.exit(1);
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
