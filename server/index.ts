import { SerializeAddon } from "@xterm/addon-serialize";

import xtermHeadless from "@xterm/headless";
const { Terminal } = xtermHeadless;

import { spawn, type IPty } from "node-pty";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { platform } from "node:os";
import { Server } from "socket.io";
import {
  CloseTerminalSchema,
  CreateTerminalSchema,
  ResizeSchema,
  TerminalInputSchema,
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
  type SocketData,
} from "../src/shared/socket-schemas.ts";

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
interface GlobalTerminal {
  pty: IPty;
  scrollback: string[];
  maxScrollbackLines: number;
  headlessTerminal: xtermHeadless.Terminal;
  serializeAddon: SerializeAddon;
}

const globalTerminals = new Map<string, GlobalTerminal>();
const MAX_SCROLLBACK_LINES = 100000;

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Send existing terminals to the new client
  globalTerminals.forEach((terminal, terminalId) => {
    socket.emit("terminal-created", { terminalId });

    // Send properly rendered terminal state
    const terminalState = terminal.serializeAddon.serialize();
    if (terminalState) {
      // Clear the client terminal first, then send the full state
      socket.emit("terminal-clear", { terminalId });
      socket.emit("terminal-output", { terminalId, data: terminalState });
    }
  });

  socket.on("create-terminal", (data) => {
    try {
      const { cols, rows } = CreateTerminalSchema.parse(data);
      const terminalId = randomUUID();

      // Check if terminal already exists (shouldn't happen with UUID)
      if (globalTerminals.has(terminalId)) {
        console.error(`Terminal ${terminalId} already exists`);
        return;
      }

      const shell = platform() === "win32" ? "powershell.exe" : "zsh";
      const ptyProcess = spawn(shell, [], {
        name: "xterm-256color",
        cols: cols || 80,
        rows: rows || 24,
        cwd: process.env.HOME,
        env: process.env,
      });

      // Create headless terminal for proper rendering
      const headlessTerminal = new Terminal({
        cols: cols || 80,
        rows: rows || 24,
        scrollback: MAX_SCROLLBACK_LINES,
        allowProposedApi: true,
      });
      const serializeAddon = new SerializeAddon();

      headlessTerminal.loadAddon(serializeAddon);

      const terminal: GlobalTerminal = {
        pty: ptyProcess,
        scrollback: [],
        maxScrollbackLines: MAX_SCROLLBACK_LINES,
        headlessTerminal,
        serializeAddon,
      };

      globalTerminals.set(terminalId, terminal);

      ptyProcess.onData((data) => {
        // Write to headless terminal for proper rendering
        headlessTerminal.write(data);

        // Broadcast to all connected clients
        io.emit("terminal-output", { terminalId, data });
      });

      ptyProcess.onExit(({ exitCode, signal }) => {
        console.log(
          `Terminal ${terminalId} exited with code ${exitCode} and signal ${signal}`
        );

        // Broadcast exit to all clients
        io.emit("terminal-exit", { terminalId, exitCode, signal });

        // Keep terminal in memory for scrollback, but mark as exited
        // You might want to clean up after some time
      });

      // Broadcast terminal creation to all clients
      io.emit("terminal-created", { terminalId });
      console.log(`Global terminal ${terminalId} created`);
    } catch (error) {
      console.error("Invalid create-terminal data:", error);
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
httpServer.listen(PORT, () => {
  console.log(`Terminal server listening on port ${PORT}`);
});

// Hot reload support
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log("Cleaning up terminals and server...");

    // Kill all running terminals
    globalTerminals.forEach((terminal, id) => {
      console.log(`Killing terminal ${id}`);
      terminal.pty.kill();
    });

    io.close();
    httpServer.close();
  });
}
