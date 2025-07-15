import {
  CloseTerminalSchema,
  CreateTerminalSchema,
  ResizeSchema,
  TerminalInputSchema,
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
  type SocketData,
  type WorkerRegister,
  type WorkerHeartbeat,
  type ServerToWorkerEvents,
  type WorkerToServerEvents,
  WorkerCreateTerminalSchema,
  WorkerTerminalInputSchema,
  WorkerResizeTerminalSchema,
  WorkerCloseTerminalSchema,
} from "@coderouter/shared";
import { SERVER_TERMINAL_CONFIG } from "@coderouter/shared/terminal-config";
import { SerializeAddon } from "@xterm/addon-serialize";
import xtermHeadless from "@xterm/headless";
import { spawn, type IPty } from "node-pty";
import { createServer } from "node:http";
import { platform, cpus, totalmem } from "node:os";
import { Server, type Socket } from "socket.io";

const { Terminal } = xtermHeadless;

interface WorkerTerminal {
  pty: IPty;
  headlessTerminal: xtermHeadless.Terminal;
  serializeAddon: SerializeAddon;
  taskId?: string;
}

// Configuration
const WORKER_ID = process.env.WORKER_ID || `worker-${Date.now()}`;
const WORKER_PORT = parseInt(process.env.WORKER_PORT || "3002", 10);
const MANAGEMENT_PORT = parseInt(process.env.MANAGEMENT_PORT || "3003", 10);
const CONTAINER_IMAGE = process.env.CONTAINER_IMAGE || "coderouter/worker:latest";
const CONTAINER_VERSION = process.env.CONTAINER_VERSION || "1.0.0";

// Terminal storage
const terminals = new Map<string, WorkerTerminal>();

// Create HTTP servers
const clientHttpServer = createServer();
const managementHttpServer = createServer();

// Socket.IO server for client connections
const clientIO = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(clientHttpServer, {
  cors: {
    origin: "*", // In production, restrict this
    methods: ["GET", "POST"],
  },
});

// Socket.IO server for main server connection (worker acts as server)
const managementIO = new Server<
  ServerToWorkerEvents,
  WorkerToServerEvents
>(managementHttpServer, {
  cors: {
    origin: "*", // In production, restrict this to main server URL
    methods: ["GET", "POST"],
  },
});

// Track connected main server
let mainServerSocket: Socket<ServerToWorkerEvents, WorkerToServerEvents> | null = null;

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
function registerWithMainServer(socket: Socket<ServerToWorkerEvents, WorkerToServerEvents>) {
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
  console.log(`Main server connected to worker ${WORKER_ID}`);
  mainServerSocket = socket;
  
  // Send registration immediately
  registerWithMainServer(socket);

  // Handle terminal operations from main server
  socket.on("worker:create-terminal", (data) => {
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
  console.log(`Client connected to worker ${WORKER_ID}:`, socket.id);

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
          console.warn(`Terminal ${terminalId} has no PID, likely already exited`);
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

  const ptyProcess = spawn(shell, args, {
    name: "xterm-256color",
    cols,
    rows,
    cwd,
    env: {
      ...env,
      WORKER_ID,
      TERM: "xterm-256color",
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
    console.log(`Worker ${WORKER_ID} heartbeat (main server not connected):`, stats);
  }
}, 30000);

// Start servers
clientHttpServer.listen(WORKER_PORT, () => {
  console.log(`Worker ${WORKER_ID} client server listening on port ${WORKER_PORT}`);
});

managementHttpServer.listen(MANAGEMENT_PORT, () => {
  console.log(`Worker ${WORKER_ID} management server listening on port ${MANAGEMENT_PORT}`);
  console.log(`Waiting for main server to connect...`);
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

  // Close servers
  clientIO.close(() => {
    console.log("Client Socket.IO server closed");
  });
  
  managementIO.close(() => {
    console.log("Management Socket.IO server closed");
  });

  clientHttpServer.close(() => {
    console.log("Client HTTP server closed");
  });
  
  managementHttpServer.close(() => {
    console.log("Management HTTP server closed");
    process.exit(0);
  });
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);