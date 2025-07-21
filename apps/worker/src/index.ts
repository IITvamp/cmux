import {
  CloseTerminalSchema,
  CreateTerminalSchema,
  ResizeSchema,
  TerminalInputSchema,
  WorkerCloseTerminalSchema,
  WorkerCreateTerminalSchema,
  WorkerResizeTerminalSchema,
  WorkerTerminalInputSchema,
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
  type ServerToWorkerEvents,
  type SocketData,
  type WorkerHeartbeat,
  type WorkerRegister,
  type WorkerToServerEvents,
} from "@coderouter/shared";
import { SERVER_TERMINAL_CONFIG } from "@coderouter/shared/terminal-config";
import { SerializeAddon } from "@xterm/addon-serialize";
import xtermHeadless from "@xterm/headless";
import { spawn, type IPty } from "node-pty";
import { promises as fs } from "node:fs";
import { createServer } from "node:http";
import { cpus, platform, totalmem } from "node:os";
import * as path from "node:path";
import { Server, type Namespace, type Socket } from "socket.io";
import { Agent, fetch } from "undici";
import { log } from "./logger.js";

const { Terminal } = xtermHeadless;

interface WorkerTerminal {
  pty: IPty;
  headlessTerminal: xtermHeadless.Terminal;
  serializeAddon: SerializeAddon;
  taskId?: string;
}

// Configuration
const WORKER_ID = process.env.WORKER_ID || `worker-${Date.now()}`;
const WORKER_PORT = parseInt(process.env.WORKER_PORT || "2377", 10);
const CONTAINER_IMAGE = process.env.CONTAINER_IMAGE || "coderouter-worker";
const CONTAINER_VERSION = process.env.CONTAINER_VERSION || "0.0.1";

// Check Docker readiness using undici with retries
async function checkDockerReadiness(): Promise<boolean> {
  const agent = new Agent({
    connect: {
      socketPath: "/var/run/docker.sock",
    },
  });

  const maxRetries = 100; // 10 seconds / 0.1 seconds
  const retryDelay = 100; // 100ms

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch("http://localhost/_ping", {
        dispatcher: agent,
        signal: AbortSignal.timeout(1000), // 1 second timeout per attempt
      });

      if (response.ok) {
        agent.close();
        return true;
      }
    } catch (_error) {
      // Ignore errors and retry
    }

    // Wait before retrying (except on last attempt)
    if (i < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  agent.close();
  return false;
}

// Terminal storage
const terminals = new Map<string, WorkerTerminal>();

// Create HTTP server
const httpServer = createServer();

// Socket.IO server with namespaces
const io = new Server(httpServer, {
  cors: {
    origin: "*", // In production, restrict this
    methods: ["GET", "POST"],
  },
  maxHttpBufferSize: 10 * 1024 * 1024, // 10MB to handle large auth files
});

// Client namespace
const clientIO = io.of("/client") as Namespace<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

// Management namespace
const managementIO = io.of("/management") as Namespace<
  ServerToWorkerEvents,
  WorkerToServerEvents
>;

// Track connected main server
let mainServerSocket: Socket<
  ServerToWorkerEvents,
  WorkerToServerEvents
> | null = null;

// Worker statistics
function getWorkerStats(): WorkerHeartbeat {
  const totalMem = totalmem();
  const usedMem = process.memoryUsage().heapUsed;

  return {
    workerId: WORKER_ID,
    timestamp: Date.now(),
    stats: {
      activeTerminals: terminals.size,
      cpuUsage: 0, // TODO: Implement actual CPU usage tracking
      memoryUsage: (usedMem / totalMem) * 100,
    },
  };
}

// Send registration info when main server connects
function registerWithMainServer(
  socket: Socket<ServerToWorkerEvents, WorkerToServerEvents>
) {
  const registration: WorkerRegister = {
    workerId: WORKER_ID,
    capabilities: {
      maxConcurrentTerminals: 50,
      supportedLanguages: ["javascript", "typescript", "python", "go", "rust"],
      gpuAvailable: false,
      memoryMB: Math.floor(totalmem() / 1024 / 1024),
      cpuCores: cpus().length,
    },
    containerInfo: {
      image: CONTAINER_IMAGE,
      version: CONTAINER_VERSION,
      platform: platform(),
    },
  };

  socket.emit("worker:register", registration);
  log(
    "INFO",
    `Worker ${WORKER_ID} sent registration to main server`,
    registration
  );
}

// Management socket server (main server connects to this)
managementIO.on("connection", (socket) => {
  log(
    "INFO",
    `Main server connected to worker ${WORKER_ID}`,
    {
      from: socket.handshake.headers.referer || "unknown",
      socketId: socket.id,
    },
    WORKER_ID
  );
  mainServerSocket = socket;

  // Send registration immediately
  registerWithMainServer(socket);

  // Handle terminal operations from main server
  socket.on("worker:create-terminal", async (data, callback) => {
    log(
      "INFO",
      "Management namespace: Received request to create terminal from main server",
      data,
      WORKER_ID
    );
    try {
      const validated = WorkerCreateTerminalSchema.parse(data);
      log("INFO", "worker:create-terminal validated", validated);

      // Handle auth files first if provided
      if (validated.authFiles && validated.authFiles.length > 0) {
        log(
          "INFO",
          `Writing ${validated.authFiles.length} auth files...`,
          undefined,
          WORKER_ID
        );
        for (const file of validated.authFiles) {
          try {
            // Expand $HOME in destination path
            const destPath = file.destinationPath.replace(
              "$HOME",
              process.env.HOME || "/root"
            );
            log(
              "INFO",
              `Writing auth file to: ${destPath}`,
              undefined,
              WORKER_ID
            );

            // Ensure directory exists
            const dir = path.dirname(destPath);
            await fs.mkdir(dir, { recursive: true });

            // Write the file
            await fs.writeFile(
              destPath,
              Buffer.from(file.contentBase64, "base64")
            );

            // Set permissions if specified
            if (file.mode) {
              await fs.chmod(destPath, parseInt(file.mode, 8));
            }

            log(
              "INFO",
              `Successfully wrote auth file: ${destPath}`,
              undefined,
              WORKER_ID
            );
          } catch (error) {
            log(
              "ERROR",
              `Failed to write auth file ${file.destinationPath}:`,
              error,
              WORKER_ID
            );
          }
        }
      }

      // Execute startup commands if provided
      if (validated.startupCommands && validated.startupCommands.length > 0) {
        log(
          "INFO",
          `Executing ${validated.startupCommands.length} startup commands...`,
          undefined,
          WORKER_ID
        );
        const { exec } = await import("node:child_process");
        const { promisify } = await import("node:util");
        const execAsync = promisify(exec);

        for (const command of validated.startupCommands) {
          try {
            log(
              "INFO",
              `Executing startup command: ${command}`,
              undefined,
              WORKER_ID
            );
            const { stdout, stderr } = await execAsync(command, {
              env: { ...process.env, ...validated.env },
            });
            if (stdout) {
              log(
                "INFO",
                `Startup command stdout: ${stdout}`,
                undefined,
                WORKER_ID
              );
            }
            if (stderr) {
              log(
                "INFO",
                `Startup command stderr: ${stderr}`,
                undefined,
                WORKER_ID
              );
            }
            log(
              "INFO",
              `Successfully executed startup command`,
              undefined,
              WORKER_ID
            );
          } catch (error) {
            log(
              "ERROR",
              `Failed to execute startup command: ${command}`,
              error,
              WORKER_ID
            );
          }
        }
      }

      log(
        "INFO",
        "Creating terminal with options",
        {
          terminalId: validated.terminalId,
          cols: validated.cols,
          rows: validated.rows,
          cwd: validated.cwd,
          env: Object.keys(validated.env || {}),
          // env: validated.env,
          command: validated.command,
          args: validated.args,
          taskId: validated.taskId,
        },
        WORKER_ID
      );

      const terminal = await createTerminal(validated.terminalId, {
        cols: validated.cols,
        rows: validated.rows,
        cwd: validated.cwd,
        env: validated.env,
        command: validated.command,
        args: validated.args,
        taskId: validated.taskId,
        startupCommands: validated.startupCommands,
      });

      if (!terminal) {
        throw new Error("Failed to create terminal");
      }

      terminals.set(validated.terminalId, terminal);

      callback({
        error: null,
        data: {
          workerId: WORKER_ID,
          terminalId: validated.terminalId,
        },
      });
      socket.emit("worker:terminal-created", {
        workerId: WORKER_ID,
        terminalId: validated.terminalId,
      });

      // if (terminal) {
      //   log(
      //     "INFO",
      //     "Terminal created successfully, emitting confirmation",
      //     {
      //       workerId: WORKER_ID,
      //       terminalId: validated.terminalId,
      //     },
      //     WORKER_ID
      //   );
      //   callback({
      //     workerId: WORKER_ID,
      //     terminalId: validated.terminalId,
      //   });
      //   socket.emit("worker:terminal-created", {
      //     workerId: WORKER_ID,
      //     terminalId: validated.terminalId,
      //   });
      // } else {
      //   log(
      //     "ERROR",
      //     "Failed to create terminal",
      //     {
      //       terminalId: validated.terminalId,
      //     },
      //     WORKER_ID
      //   );
      // }
    } catch (error) {
      log(
        "ERROR",
        "Error creating terminal from main server",
        error,
        WORKER_ID
      );
      callback({
        error: error instanceof Error ? error : new Error(error as string),
        data: null,
      });
      socket.emit("worker:error", {
        workerId: WORKER_ID,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  socket.on("worker:terminal-input", (data) => {
    try {
      const validated = WorkerTerminalInputSchema.parse(data);
      const terminal = terminals.get(validated.terminalId);
      if (terminal && terminal.pty) {
        terminal.pty.write(validated.data);
      }
    } catch (error) {
      console.error("Error handling terminal input from main server:", error);
    }
  });

  socket.on("worker:resize-terminal", (data) => {
    try {
      const validated = WorkerResizeTerminalSchema.parse(data);
      const terminal = terminals.get(validated.terminalId);
      if (terminal && terminal.pty) {
        terminal.pty.resize(validated.cols, validated.rows);
        terminal.headlessTerminal.resize(validated.cols, validated.rows);
      }
    } catch (error) {
      console.error("Error resizing terminal from main server:", error);
    }
  });

  socket.on("worker:close-terminal", (data) => {
    try {
      const validated = WorkerCloseTerminalSchema.parse(data);
      const terminal = terminals.get(validated.terminalId);
      if (terminal && terminal.pty) {
        terminal.pty.kill();
        terminals.delete(validated.terminalId);
        clientIO.emit("terminal-closed", { terminalId: validated.terminalId });

        socket.emit("worker:terminal-closed", {
          workerId: WORKER_ID,
          terminalId: validated.terminalId,
        });
      }
    } catch (error) {
      console.error("Error closing terminal from main server:", error);
    }
  });

  socket.on("worker:check-docker", async (callback) => {
    console.log(`Worker ${WORKER_ID} checking Docker readiness`);

    try {
      // Check if Docker socket is accessible
      const dockerReady = await checkDockerReadiness();

      callback({
        ready: dockerReady,
        message: dockerReady ? "Docker is ready" : "Docker is not ready",
      });
    } catch (error) {
      callback({
        ready: false,
        message: `Error checking Docker: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  });

  socket.on("worker:shutdown", () => {
    console.log(`Worker ${WORKER_ID} received shutdown command`);
    gracefulShutdown();
  });

  socket.on("disconnect", () => {
    console.log(`Main server disconnected from worker ${WORKER_ID}`);
    mainServerSocket = null;
  });
});

// Client socket server
clientIO.on("connection", (socket) => {
  console.log(
    `Client connected to worker ${WORKER_ID}:`,
    socket.id,
    "from",
    socket.handshake.headers.referer || "unknown"
  );

  // Send existing terminals to new connections
  terminals.forEach((terminal, terminalId) => {
    socket.emit("terminal-created", { terminalId });

    // Send terminal state
    const terminalState = terminal.serializeAddon.serialize();
    if (terminalState) {
      socket.emit("terminal-restore", { terminalId, data: terminalState });
    }
  });

  socket.on("create-terminal", async (data) => {
    console.log(
      `Client namespace: Received request to create terminal from client ${socket.id}`,
      data
    );
    try {
      const { cols, rows, id } = CreateTerminalSchema.parse(data);

      if (id && terminals.has(id)) {
        console.error(`Terminal ${id} already exists`);
        return;
      }

      const terminalId = id || crypto.randomUUID();
      const terminal = await createTerminal(terminalId, { cols, rows });

      if (terminal) {
        clientIO.emit("terminal-created", { terminalId });
        console.log(`Terminal ${terminalId} created on worker ${WORKER_ID}`);

        // Notify main server if connected
        if (mainServerSocket) {
          mainServerSocket.emit("worker:terminal-created", {
            workerId: WORKER_ID,
            terminalId,
          });
        }
      }
    } catch (error) {
      console.error("Invalid create-terminal data:", error);
    }
  });

  socket.on("terminal-input", (inputData) => {
    try {
      const { terminalId, data } = TerminalInputSchema.parse(inputData);
      const terminal = terminals.get(terminalId);

      if (terminal && terminal.pty) {
        terminal.pty.write(data);
      }
    } catch (error) {
      console.error("Invalid terminal-input data:", error);
    }
  });

  socket.on("resize", (resizeData) => {
    try {
      const { terminalId, cols, rows } = ResizeSchema.parse(resizeData);
      const terminal = terminals.get(terminalId);

      if (terminal && terminal.pty) {
        if (!terminal.pty.pid) {
          console.warn(
            `Terminal ${terminalId} has no PID, likely already exited`
          );
          terminals.delete(terminalId);
        } else {
          // Resize hack similar to main server
          terminal.pty.resize(cols - 1, rows - 1);
          terminal.headlessTerminal.resize(cols - 1, rows - 1);
          terminal.pty.resize(cols, rows);
          terminal.headlessTerminal.resize(cols, rows);
        }
      }
    } catch (error) {
      console.error("Invalid resize data:", error);
    }
  });

  socket.on("close-terminal", (closeData) => {
    try {
      const { terminalId } = CloseTerminalSchema.parse(closeData);
      const terminal = terminals.get(terminalId);

      if (terminal && terminal.pty) {
        terminal.pty.kill();
        terminals.delete(terminalId);
        clientIO.emit("terminal-closed", { terminalId });
        console.log(`Terminal ${terminalId} closed on worker ${WORKER_ID}`);

        // Notify main server if connected
        if (mainServerSocket) {
          mainServerSocket.emit("worker:terminal-closed", {
            workerId: WORKER_ID,
            terminalId,
          });
        }
      }
    } catch (error) {
      console.error("Invalid close-terminal data:", error);
    }
  });

  socket.on("get-active-terminals", () => {
    const activeTerminals = Array.from(terminals.entries()).map(
      ([id, terminal]) => ({
        terminalId: id,
        taskId: terminal.taskId,
      })
    );
    socket.emit("active-terminals", activeTerminals);
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected from worker ${WORKER_ID}:`, socket.id);
  });
});

// Create terminal helper function
async function createTerminal(
  terminalId: string,
  options: {
    cols?: number;
    rows?: number;
    cwd?: string;
    env?: Record<string, string>;
    command?: string;
    args?: string[];
    taskId?: string;
    startupCommands?: string[];
  } = {}
): Promise<WorkerTerminal | null> {
  if (terminals.has(terminalId)) {
    log("ERROR", `Terminal ${terminalId} already exists`);
    return null;
  }

  const {
    cols = SERVER_TERMINAL_CONFIG.cols,
    rows = SERVER_TERMINAL_CONFIG.rows,
    cwd = process.env.HOME || "/",
    env = {},
    command,
    args = [],
    taskId,
  } = options;

  const shell = command || (platform() === "win32" ? "powershell.exe" : "bash");

  log("INFO", `[createTerminal] Creating terminal ${terminalId}:`, {
    cols,
    rows,
    cwd,
    command,
    args,
    envKeys: Object.keys(env),
    shell,
  });

  // Prepare the spawn command and args
  let spawnCommand: string;
  let spawnArgs: string[];

  if (command === "tmux") {
    // Direct tmux command from agent spawner
    spawnCommand = command;
    spawnArgs = args;
    log("INFO", `[createTerminal] Using direct tmux command:`, {
      spawnCommand,
      spawnArgs,
    });
  } else {
    // Create tmux session with command
    spawnCommand = "tmux";
    spawnArgs = ["new-session", "-A", "-s", terminalId];
    spawnArgs.push("-x", cols.toString(), "-y", rows.toString());

    if (command) {
      spawnArgs.push(command);
      if (args.length > 0) {
        spawnArgs.push(...args);
      }
    } else {
      spawnArgs.push(shell);
    }
    log("INFO", `[createTerminal] Creating tmux session:`, {
      spawnCommand,
      spawnArgs,
    });
  }

  const ptyEnv = {
    ...process.env,
    ...env, // Override with provided env vars
    WORKER_ID,
    TERM: "xterm-256color",
    PS1: "\\u@\\h:\\w\\$ ", // Basic prompt
    SHELL: "/bin/bash",
    USER: process.env.USER || "root",
    HOME: process.env.HOME || "/root",
    PATH: `/root/.bun/bin:${process.env.PATH || "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"}`,
  };

  log("INFO", "Spawning PTY process", {
    command: spawnCommand,
    args: spawnArgs,
    cwd,
    envKeys: Object.keys(ptyEnv),
  });

  let ptyProcess: IPty;
  try {
    ptyProcess = spawn(spawnCommand, spawnArgs, {
      name: "xterm-256color",
      cols,
      rows,
      cwd,
      env: ptyEnv,
    });

    log("INFO", "PTY process spawned successfully", {
      pid: ptyProcess.pid,
      terminalId,
    });
  } catch (error) {
    log("ERROR", "Failed to spawn PTY process", error);
    return null;
  }

  const headlessTerminal = new Terminal({
    cols,
    rows,
    scrollback: SERVER_TERMINAL_CONFIG.scrollback,
    allowProposedApi: SERVER_TERMINAL_CONFIG.allowProposedApi,
  });

  const serializeAddon = new SerializeAddon();
  headlessTerminal.loadAddon(serializeAddon);

  const terminal: WorkerTerminal = {
    pty: ptyProcess,
    headlessTerminal,
    serializeAddon,
    taskId,
  };

  terminals.set(terminalId, terminal);
  log("INFO", "Terminal added to registry", {
    terminalId,
    totalTerminals: terminals.size,
  });

  // Handle PTY data
  ptyProcess.onData((data) => {
    headlessTerminal.write(data);
    clientIO.emit("terminal-output", { terminalId, data });

    // Also send to main server if connected
    if (mainServerSocket) {
      mainServerSocket.emit("worker:terminal-output", {
        workerId: WORKER_ID,
        terminalId,
        data,
      });
    }
  });

  // Handle PTY exit
  ptyProcess.onExit(async ({ exitCode, signal }) => {
    log("INFO", `Terminal ${terminalId} exited`, { exitCode, signal });

    // Save the full state
    const serializedState = serializeAddon.serialize();
    const stateFile = `/var/log/cmux/terminal-state-${terminalId}.log`;

    try {
      await fs.writeFile(stateFile, serializedState);
      log("INFO", `Full state saved to ${stateFile}`);
    } catch (error) {
      log("ERROR", `Failed to save terminal state`, error);
    }

    terminals.delete(terminalId);
    clientIO.emit("terminal-exit", { terminalId, exitCode, signal });

    // Notify main server if connected
    if (mainServerSocket) {
      mainServerSocket.emit("worker:terminal-exit", {
        workerId: WORKER_ID,
        terminalId,
        exitCode,
        signal,
      });
    }
  });

  log("INFO", "Terminal creation complete", { terminalId });
  return terminal;
}

const ENABLE_HEARTBEAT = false;
if (ENABLE_HEARTBEAT) {
  // Heartbeat interval (send stats every 30 seconds)
  setInterval(() => {
    const stats = getWorkerStats();

    if (mainServerSocket) {
      mainServerSocket.emit("worker:heartbeat", stats);
    } else {
      console.log(
        `Worker ${WORKER_ID} heartbeat (main server not connected):`,
        stats
      );
    }
  }, 30000);
}

// Start server
httpServer.listen(WORKER_PORT, () => {
  log(
    "INFO",
    `Worker ${WORKER_ID} starting on port ${WORKER_PORT}`,
    undefined,
    WORKER_ID
  );
  log(
    "INFO",
    "Namespaces:",
    {
      client: "/client",
      management: "/management",
    },
    WORKER_ID
  );
  log(
    "INFO",
    "Worker ready, waiting for terminal creation commands via socket.io",
    undefined,
    WORKER_ID
  );
});

// Graceful shutdown
function gracefulShutdown() {
  console.log(`Worker ${WORKER_ID} shutting down...`);

  // Kill all terminals
  terminals.forEach((terminal, id) => {
    console.log(`Killing terminal ${id}`);
    try {
      terminal.pty.kill();
    } catch (error) {
      console.error(`Error killing terminal ${id}:`, error);
    }
  });
  terminals.clear();

  // Close server
  io.close(() => {
    console.log("Socket.IO server closed");
  });

  httpServer.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
