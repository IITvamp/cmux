import { createServer } from "node:http";
import { Server } from "socket.io";
import { api } from "@coderouter/convex/api";
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
import { createTerminal, type GlobalTerminal } from "./terminal.ts";
import { convex } from "./utils/convexClient.ts";
import { getWorktreePath, setupProjectWorkspace } from "./workspace.ts";

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
    try {
      const taskData = StartTaskSchema.parse(data);

      // First get worktree info (generates branch name and paths)
      const worktreeInfo = await getWorktreePath({
        repoUrl: taskData.repoUrl,
        branch: taskData.branch,
      });

      // Create task in Convex database first
      const taskId = await convex.mutation(api.tasks.create, {
        text: taskData.taskDescription.substring(0, 100), // First 100 chars as summary
        description: taskData.taskDescription,
        projectFullName: taskData.projectFullName,
        branch: taskData.branch || "main",
        worktreePath: worktreeInfo.worktreePath,
      });

      // Run workspace setup and task run creation in parallel
      const [workspaceResult, taskRunId] = await Promise.all([
        setupProjectWorkspace({
          repoUrl: taskData.repoUrl,
          branch: taskData.branch,
          worktreeInfo,
        }),
        convex.mutation(api.taskRuns.create, {
          taskId,
          prompt: taskData.taskDescription,
        }),
      ]);

      if (!workspaceResult.success || !workspaceResult.worktreePath) {
        callback({
          taskId: "error",
          error: workspaceResult.error || "Failed to setup workspace",
        });
        return;
      }

      // Create terminal for the Claude session
      const terminalId = taskRunId;
      const terminal = createTerminal(terminalId, globalTerminals, io, {
        cwd: workspaceResult.worktreePath,
        command: "claude",
        args: ["--dangerously-skip-permissions", taskData.taskDescription],
        env: {
          ...process.env,
          PROMPT: taskData.taskDescription,
        } as Record<string, string>,
      });

      if (!terminal) {
        callback({
          taskId: taskId as string,
          error: "Failed to create terminal for Claude session",
        });
        return;
      }

      // Return success via callback
      callback({
        taskId: taskId as string,
        worktreePath: workspaceResult.worktreePath!,
        terminalId,
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
