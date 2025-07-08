import {
  CloseTerminalSchema,
  CreateTerminalSchema,
  ResizeSchema,
  StartTaskSchema,
  TerminalInputSchema,
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
  type SocketData,
} from "@coderouter/shared";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { spawnAllAgents } from "./agentSpawner.js";
import { createTerminal, type GlobalTerminal } from "./terminal.js";

const httpServer = createServer();

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Global terminal storage - shared across all connections
const globalTerminals = new Map<string, GlobalTerminal>();

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  globalTerminals.forEach((terminal, terminalId) => {
    socket.emit("terminal-created", { terminalId });

    // Send properly rendered terminal state
    const terminalState = terminal.serializeAddon.serialize();
    if (terminalState) {
      // Send terminal restore event with serialized state
      socket.emit("terminal-restore", { terminalId, data: terminalState });
    }
  });

  socket.on("create-terminal", (data) => {
    try {
      const { cols, rows, id } = CreateTerminalSchema.parse(data);
      if (id && globalTerminals.has(id)) {
        console.error(`Terminal ${id} already exists`);
        return;
      }
      const terminalId = id || crypto.randomUUID();

      createTerminal(terminalId, globalTerminals, io, { cols, rows });
    } catch (error) {
      console.error("Invalid create-terminal data:", error);
    }
  });

  socket.on("start-task", async (data, callback) => {
    console.log("skibidi start task");
    try {
      console.log("got data", data);
      const taskData = StartTaskSchema.parse(data);
      console.log("starting task!", taskData);

      // Use the taskId provided by the client
      const taskId = taskData.taskId;

      // Spawn all agents in parallel (each will create its own taskRun)
      const agentResults = await spawnAllAgents(taskId, globalTerminals, io, {
        repoUrl: taskData.repoUrl,
        branch: taskData.branch,
        taskDescription: taskData.taskDescription,
      });

      // Check if at least one agent spawned successfully
      const successfulAgents = agentResults.filter((result) => result.success);
      if (successfulAgents.length === 0) {
        callback({
          taskId: "error",
          error: "Failed to spawn any agents",
        });
        return;
      }

      // Log results for debugging
      agentResults.forEach((result) => {
        if (result.success) {
          console.log(
            `Successfully spawned ${result.agentName} with terminal ${result.terminalId}`
          );
        } else {
          console.error(`Failed to spawn ${result.agentName}: ${result.error}`);
        }
      });

      // Return the first successful agent's info (you might want to modify this to return all)
      const primaryAgent = successfulAgents[0];
      callback({
        taskId,
        worktreePath: primaryAgent.worktreePath,
        terminalId: primaryAgent.terminalId,
      });
    } catch (error) {
      console.error("Error in start-task:", error);
      callback({
        taskId: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  socket.on("terminal-input", (inputData) => {
    try {
      const { terminalId, data } = TerminalInputSchema.parse(inputData);
      const terminal = globalTerminals.get(terminalId);

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
      const terminal = globalTerminals.get(terminalId);

      if (terminal && terminal.pty) {
        terminal.pty.resize(cols, rows);
        terminal.headlessTerminal.resize(cols, rows);
      }
    } catch (error) {
      console.error("Invalid resize data:", error);
    }
  });

  socket.on("close-terminal", (closeData) => {
    try {
      const { terminalId } = CloseTerminalSchema.parse(closeData);
      const terminal = globalTerminals.get(terminalId);

      if (terminal && terminal.pty) {
        terminal.pty.kill();
        globalTerminals.delete(terminalId);

        // Broadcast terminal closure to all clients
        io.emit("terminal-closed", { terminalId });
        console.log(`Global terminal ${terminalId} closed`);
      }
    } catch (error) {
      console.error("Invalid close-terminal data:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    // No need to kill terminals on disconnect since they're global
  });
});

const PORT = process.env.PORT || 3001;
const server = httpServer.listen(PORT, () => {
  console.log(`Terminal server listening on port ${PORT}`);
});

let isCleaningUp = false;
let isCleanedUp = false;

// Hot reload support
if (import.meta.hot) {
  import.meta.hot.dispose(async () => {
    if (isCleaningUp || isCleanedUp) {
      console.log("Cleanup already in progress or completed, skipping...");
      return;
    }

    isCleaningUp = true;
    console.log("Cleaning up terminals and server...");

    // Kill all running terminals
    globalTerminals.forEach((terminal, id) => {
      console.log(`Killing terminal ${id}`);
      try {
        terminal.pty.kill();
      } catch (error) {
        console.error(`Error killing terminal ${id}:`, error);
      }
    });
    globalTerminals.clear();

    // Close socket.io
    console.log("Closing socket.io server...");
    await new Promise<void>((resolve) => {
      io.close(() => {
        console.log("Socket.io server closed");
        resolve();
      });
    });

    // Close HTTP server only if it's still listening
    console.log("Closing HTTP server...");
    await new Promise<void>((resolve) => {
      if (server.listening) {
        server.close((error) => {
          if (error) {
            console.error("Error closing HTTP server:", error);
          } else {
            console.log("HTTP server closed");
          }
          resolve();
        });
      } else {
        console.log("HTTP server already closed");
        resolve();
      }
    });

    isCleanedUp = true;
    console.log("Cleanup completed");
  });

  import.meta.hot.accept(() => {
    console.log("Hot reload triggered");
  });
}
