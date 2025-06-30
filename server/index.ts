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

const clientTerminals = new Map<string, Map<string, IPty>>();

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  clientTerminals.set(socket.id, new Map());

  socket.on("create-terminal", (data) => {
    try {
      const { cols, rows } = CreateTerminalSchema.parse(data);
      const terminalId = randomUUID();
      const shell = platform() === "win32" ? "powershell.exe" : "zsh";
      const ptyProcess = spawn(shell, [], {
        name: "xterm-256color",
        cols: cols || 80,
        rows: rows || 24,
        cwd: process.env.HOME,
        env: process.env,
      });

      const terminals = clientTerminals.get(socket.id);
      if (terminals) {
        terminals.set(terminalId, ptyProcess);
      }

      ptyProcess.onData((data) => {
        socket.emit("terminal-output", { terminalId, data });
      });

      ptyProcess.onExit(({ exitCode, signal }) => {
        console.log(
          `Terminal ${terminalId} exited with code ${exitCode} and signal ${signal}`
        );
        socket.emit("terminal-exit", { terminalId, exitCode, signal });
        if (terminals) {
          terminals.delete(terminalId);
        }
      });

      socket.emit("terminal-created", { terminalId });
      console.log(`Terminal ${terminalId} created for ${socket.id}`);
    } catch (error) {
      console.error("Invalid create-terminal data:", error);
    }
  });

  socket.on("terminal-input", (inputData) => {
    try {
      const { terminalId, data } = TerminalInputSchema.parse(inputData);
      const terminals = clientTerminals.get(socket.id);
      if (terminals) {
        const ptyProcess = terminals.get(terminalId);
        if (ptyProcess) {
          ptyProcess.write(data);
        }
      }
    } catch (error) {
      console.error("Invalid terminal-input data:", error);
    }
  });

  socket.on("resize", (resizeData) => {
    try {
      const { terminalId, cols, rows } = ResizeSchema.parse(resizeData);
      const terminals = clientTerminals.get(socket.id);
      if (terminals) {
        const ptyProcess = terminals.get(terminalId);
        if (ptyProcess) {
          ptyProcess.resize(cols, rows);
        }
      }
    } catch (error) {
      console.error("Invalid resize data:", error);
    }
  });

  socket.on("close-terminal", (closeData) => {
    try {
      const { terminalId } = CloseTerminalSchema.parse(closeData);
      const terminals = clientTerminals.get(socket.id);
      if (terminals) {
        const ptyProcess = terminals.get(terminalId);
        if (ptyProcess) {
          ptyProcess.kill();
          terminals.delete(terminalId);
          console.log(`Terminal ${terminalId} closed`);
        }
      }
    } catch (error) {
      console.error("Invalid close-terminal data:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    const terminals = clientTerminals.get(socket.id);
    if (terminals) {
      terminals.forEach((ptyProcess) => {
        ptyProcess.kill();
      });
      clientTerminals.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Terminal server listening on port ${PORT}`);
});
