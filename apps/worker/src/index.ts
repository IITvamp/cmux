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
import { createServer } from "node:http";
import { cpus, platform, totalmem } from "node:os";
import { Server, type Socket, type Namespace } from "socket.io";
import { Agent, fetch } from "undici";

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
const CONTAINER_IMAGE =
  process.env.CONTAINER_IMAGE || "coderouter/worker:latest";
const CONTAINER_VERSION = process.env.CONTAINER_VERSION || "1.0.0";

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
  console.log(`Worker ${WORKER_ID} sent registration to main server`);
}

// Management socket server (main server connects to this)
managementIO.on("connection", (socket) => {
  console.log(`Main server connected to worker ${WORKER_ID} from`, socket.handshake.headers.referer || "unknown");
  mainServerSocket = socket;

  // Send registration immediately
  registerWithMainServer(socket);

  // Handle terminal operations from main server
  socket.on("worker:create-terminal", (data) => {
    console.log(`Management namespace: Received request to create terminal from main server`, data);
    try {
      const validated = WorkerCreateTerminalSchema.parse(data);
      const terminal = createTerminal(validated.terminalId, {
        cols: validated.cols,
        rows: validated.rows,
        cwd: validated.cwd,
        env: validated.env,
        command: validated.command,
        args: validated.args,
        taskId: validated.taskId,
      });

      if (terminal) {
        socket.emit("worker:terminal-created", {
          workerId: WORKER_ID,
          terminalId: validated.terminalId,
        });
      }
    } catch (error) {
      console.error("Error creating terminal from main server:", error);
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
  console.log(`Client connected to worker ${WORKER_ID}:`, socket.id, "from", socket.handshake.headers.referer || "unknown");

  // Send existing terminals to new connections
  terminals.forEach((terminal, terminalId) => {
    socket.emit("terminal-created", { terminalId });

    // Send terminal state
    const terminalState = terminal.serializeAddon.serialize();
    if (terminalState) {
      socket.emit("terminal-restore", { terminalId, data: terminalState });
    }
  });

  socket.on("create-terminal", (data) => {
    console.log(`Client namespace: Received request to create terminal from client ${socket.id}`, data);
    try {
      const { cols, rows, id } = CreateTerminalSchema.parse(data);

      if (id && terminals.has(id)) {
        console.error(`Terminal ${id} already exists`);
        return;
      }

      const terminalId = id || crypto.randomUUID();
      const terminal = createTerminal(terminalId, { cols, rows });

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
function createTerminal(
  terminalId: string,
  options: {
    cols?: number;
    rows?: number;
    cwd?: string;
    env?: Record<string, string>;
    command?: string;
    args?: string[];
    taskId?: string;
  } = {}
): WorkerTerminal | null {
  if (terminals.has(terminalId)) {
    console.error(`Terminal ${terminalId} already exists`);
    return null;
  }

  const {
    cols = SERVER_TERMINAL_CONFIG.cols,
    rows = SERVER_TERMINAL_CONFIG.rows,
    cwd = process.env.HOME || "/",
    env = process.env as Record<string, string>,
    command,
    args = [],
    taskId,
  } = options;

  const shell = command || (platform() === "win32" ? "powershell.exe" : "bash");

  // Create tmux session directly - tmux will handle existing sessions
  const tmuxArgs: string[] = [];

  // Always use 'new-session' - tmux will attach if session exists
  tmuxArgs.push("new-session", "-A", "-s", terminalId);
  // Add the dimensions
  tmuxArgs.push("-x", cols.toString(), "-y", rows.toString());

  // If a command is provided, add it
  if (command) {
    tmuxArgs.push(command);
    if (args.length > 0) {
      tmuxArgs.push(...args);
    }
  } else {
    // If no command, use shell
    tmuxArgs.push(shell);
  }

  console.log(
    `Creating/attaching tmux session ${terminalId} with args:`,
    tmuxArgs
  );

  const ptyProcess = spawn("tmux", tmuxArgs, {
    name: "xterm-256color",
    cols,
    rows,
    cwd,
    env: {
      ...env,
      WORKER_ID,
      TERM: "xterm-256color",
      PS1: "\\u@\\h:\\w\\$ ",  // Basic prompt
      SHELL: "/bin/bash",
      USER: process.env.USER || "root",
      HOME: process.env.HOME || "/root",
    },
  });

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
  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log(
      `Terminal ${terminalId} exited with code ${exitCode} and signal ${signal}`
    );

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

  return terminal;
}

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

// Start server
httpServer.listen(WORKER_PORT, async () => {
  console.log(
    `Worker ${WORKER_ID} listening on port ${WORKER_PORT}`
  );
  console.log(`  - Client namespace: /client`);
  console.log(`  - Management namespace: /management`);
  console.log(`Waiting for connections...`);
  
  // Create default terminal
  const terminalId = "default";
  
  // Check if there's an initial command to run
  const initialCommand = process.env.INITIAL_COMMAND || process.env.WORKER_INITIAL_COMMAND;
  
  console.log(`Creating default terminal${initialCommand ? ` with command: ${initialCommand}` : ""}`);
  
  const terminal = createTerminal(terminalId, {
    cols: 80,
    rows: 24,
    command: initialCommand ? "/bin/bash" : undefined,
    args: initialCommand ? ["-c", initialCommand] : undefined
  });
  
  if (terminal) {
    console.log(`Default terminal '${terminalId}' created successfully`);
    // Notify all connected clients
    clientIO.emit("terminal-created", { terminalId });
  }
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
