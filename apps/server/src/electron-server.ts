import { api } from "@cmux/convex/api";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { GitDiffManager } from "./gitDiff.js";
import { createIPCTransport } from "./transports/ipc-transport.js";
import { setupSocketHandlers } from "./socket-handlers.js";
import { serverLogger, dockerLogger } from "./utils/fileLogger.js";
import { getConvex } from "./utils/convexClient.js";
import { waitForConvex } from "./utils/waitForConvex.js";
import { DockerVSCodeInstance } from "./vscode/DockerVSCodeInstance.js";
import { VSCodeInstance } from "./vscode/VSCodeInstance.js";
import type { GitRepoInfo } from "./server.js";

const execAsync = promisify(exec);

export async function electronStartServer({
  defaultRepo,
}: {
  defaultRepo?: GitRepoInfo | null;
}) {
  // Set up global error handlers to prevent crashes
  process.on("unhandledRejection", (reason, promise) => {
    serverLogger.error("Unhandled Rejection at:", promise, "reason:", reason);
    // Don't exit the process - just log the error
  });

  process.on("uncaughtException", (error) => {
    serverLogger.error("Uncaught Exception:", error);
    // In Electron main process, never hard-exit; log and continue
    if (process.versions?.electron) {
      return;
    }
    // Don't exit for file system errors
    if (
      error &&
      typeof error === "object" &&
      "errno" in error &&
      "syscall" in error &&
      "path" in error
    ) {
      const fsError = error;
      if (fsError.errno === 0 || fsError.syscall === "TODO") {
        serverLogger.error(
          "File system watcher error - continuing without watching:",
          fsError.path
        );
        return;
      }
    }
    // For other critical errors in non-Electron contexts, exit
    process.exit(1);
  });

  // Check system limits and warn if too low
  try {
    const { stdout } = await execAsync("ulimit -n");
    const limit = parseInt(stdout.trim(), 10);
    if (limit < 8192) {
      serverLogger.warn(
        `System file descriptor limit is low: ${limit}. Consider increasing it with 'ulimit -n 8192' to avoid file watcher issues.`
      );
    }
  } catch (error) {
    serverLogger.warn("Could not check system file descriptor limit:", error);
  }

  // Git diff manager instance
  const gitDiffManager = new GitDiffManager();

  // Create IPC transport for Electron (no HTTP server!)
  const rt = createIPCTransport();

  // Set up all socket handlers
  setupSocketHandlers(rt, gitDiffManager, defaultRepo);

  serverLogger.info(`Electron IPC server started (no HTTP port)`);

  // Wait for Convex (non-fatal for Electron: log and continue if unavailable)
  try {
    await waitForConvex();
  } catch (e) {
    if (process.versions?.electron) {
      serverLogger.warn("Convex not ready; continuing in Electron context", e);
    } else {
      throw e;
    }
  }

  // Store default repo info if provided
  if (defaultRepo?.remoteName) {
    try {
      serverLogger.info(
        `Storing default repository: ${defaultRepo.remoteName}`
      );
      await getConvex().mutation(api.github.upsertRepo, {
        teamSlugOrId: "default",
        fullName: defaultRepo.remoteName,
        org: defaultRepo.remoteName.split("/")[0] || "",
        name: defaultRepo.remoteName.split("/")[1] || "",
        gitRemote: defaultRepo.remoteUrl || "",
        provider: "github", // Default to github, could be enhanced to detect provider
      });

      // Also emit to all connected clients
      const defaultRepoData = {
        repoFullName: defaultRepo.remoteName,
        branch: defaultRepo.currentBranch || defaultRepo.defaultBranch,
        localPath: defaultRepo.path,
      };
      serverLogger.info(`Emitting default-repo event:`, defaultRepoData);
      rt.emit("default-repo", defaultRepoData);

      serverLogger.info(
        `Successfully set default repository: ${defaultRepo.remoteName}`
      );
    } catch (error) {
      serverLogger.error("Error storing default repo:", error);
    }
  } else if (defaultRepo) {
    serverLogger.warn(
      `Default repo provided but no remote name found:`,
      defaultRepo
    );
  }

  let isCleaningUp = false;
  let isCleanedUp = false;

  async function cleanup() {
    if (isCleaningUp || isCleanedUp) {
      serverLogger.info(
        "Cleanup already in progress or completed, skipping..."
      );
      return;
    }

    isCleaningUp = true;
    serverLogger.info("Cleaning up terminals and IPC server...");

    // Dispose of all file watchers
    serverLogger.info("Disposing file watchers...");
    gitDiffManager.dispose();

    // Stop Docker container state sync
    DockerVSCodeInstance.stopContainerStateSync();

    // Stop all VSCode instances using docker commands
    try {
      // Get all cmux containers
      const { stdout } = await execAsync(
        'docker ps -a --filter "name=cmux-" --format "{{.Names}}"'
      );
      const containerNames = stdout
        .trim()
        .split("\n")
        .filter((name) => name);

      if (containerNames.length > 0) {
        serverLogger.info(
          `Stopping ${containerNames.length} VSCode containers: ${containerNames.join(", ")}`
        );

        // Stop all containers in parallel with a single docker command
        exec(`docker stop ${containerNames.join(" ")}`, (error) => {
          if (error) {
            serverLogger.error("Error stopping containers:", error);
          } else {
            serverLogger.info("All containers stopped");
          }
        });

        // Don't wait for the command to finish
      } else {
        serverLogger.info("No VSCode containers found to stop");
      }
    } catch (error) {
      serverLogger.error(
        "Error stopping containers via docker command:",
        error
      );
    }

    VSCodeInstance.clearInstances();

    // Clean up git diff manager
    gitDiffManager.dispose();

    // Close IPC transport
    serverLogger.info("Closing IPC transport...");
    await rt.close();

    isCleanedUp = true;
    serverLogger.info("Cleanup completed");

    // Close logger instances to ensure all data is flushed
    serverLogger.close();
    dockerLogger.close();
  }

  // Handle process termination signals (avoid hard exit in Electron)
  if (!(process.versions as any)?.electron) {
    process.on("SIGINT", async () => {
      serverLogger.info("Received SIGINT, shutting down gracefully...");
      await cleanup();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      serverLogger.info("Received SIGTERM, shutting down gracefully...");
      await cleanup();
      process.exit(0);
    });
  }

  // Hot reload support
  if (import.meta.hot) {
    import.meta.hot.dispose(cleanup);

    import.meta.hot.accept(() => {
      serverLogger.info("Hot reload triggered");
    });
  }

  return { cleanup };
}
