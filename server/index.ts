import { randomUUID } from "crypto";
import { createServer } from "http";
import { spawn, type IPty } from "node-pty";
import { platform } from "os";
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
}

const globalTerminals = new Map<string, GlobalTerminal>();
const MAX_SCROLLBACK_LINES = 10000;

// Helper function to add data to scrollback buffer
function addToScrollback(terminal: GlobalTerminal, data: string) {
  // Split data by newlines but keep the newline characters
  const lines = data.split(/(\r?\n)/);
  
  for (const line of lines) {
    if (line.length > 0) {
      terminal.scrollback.push(line);
    }
  }
  
  // Trim scrollback if it exceeds max lines
  if (terminal.scrollback.length > terminal.maxScrollbackLines) {
    terminal.scrollback = terminal.scrollback.slice(
      terminal.scrollback.length - terminal.maxScrollbackLines
    );
  }
}

// Helper function to get scrollback as a single string
function getScrollbackString(terminal: GlobalTerminal): string {
  return terminal.scrollback.join("");
}

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Send existing terminals to the new client
  globalTerminals.forEach((terminal, terminalId) => {
    socket.emit("terminal-created", { terminalId });
    
    // Send scrollback history
    const scrollback = getScrollbackString(terminal);
    if (scrollback) {
      socket.emit("terminal-output", { terminalId, data: scrollback });
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

      const terminal: GlobalTerminal = {
        pty: ptyProcess,
        scrollback: [],
        maxScrollbackLines: MAX_SCROLLBACK_LINES,
      };

      globalTerminals.set(terminalId, terminal);

      ptyProcess.onData((data) => {
        // Add to scrollback buffer
        addToScrollback(terminal, data);
        
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