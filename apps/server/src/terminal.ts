import { api } from "@coderouter/convex/api";
import type { Id } from "@coderouter/convex/dataModel";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@coderouter/shared";
import { SERVER_TERMINAL_CONFIG } from "@coderouter/shared/terminal-config";
import { SerializeAddon } from "@xterm/addon-serialize";
import xtermHeadless from "@xterm/headless";
import { spawn, type IPty } from "node-pty";
import { platform } from "node:os";
import type { Server } from "socket.io";
import { convex } from "./utils/convexClient.js";
const { Terminal } = xtermHeadless;

export interface GlobalTerminal {
  pty: IPty;
  scrollback: string[];
  maxScrollbackLines: number;
  headlessTerminal: xtermHeadless.Terminal;
  serializeAddon: SerializeAddon;
  logDebounceTimer?: NodeJS.Timeout;
}

const MAX_SCROLLBACK_LINES = SERVER_TERMINAL_CONFIG.scrollback;

export function createTerminal(
  terminalId: string,
  globalTerminals: Map<string, GlobalTerminal>,
  io: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
  options: {
    cols?: number;
    rows?: number;
    cwd?: string;
    env?: Record<string, string>;
    command?: string;
    args?: string[];
    taskRunId?: Id<"taskRuns"> | string;
  } = {}
): GlobalTerminal | null {
  if (globalTerminals.has(terminalId)) {
    console.error(`Terminal ${terminalId} already exists`);
    return null;
  }

  const {
    cols = SERVER_TERMINAL_CONFIG.cols,
    rows = SERVER_TERMINAL_CONFIG.rows,
    cwd = process.env.HOME,
    env = process.env as Record<string, string>,
    command,
    args = [],
    taskRunId,
  } = options;

  const shell = command || (platform() === "win32" ? "powershell.exe" : "zsh");

  const ptyProcess = spawn(shell, args, {
    name: "xterm-256color",
    cols,
    rows,
    cwd,
    env,
  });

  const headlessTerminal = new Terminal({
    cols,
    rows,
    scrollback: SERVER_TERMINAL_CONFIG.scrollback,
    allowProposedApi: SERVER_TERMINAL_CONFIG.allowProposedApi,
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

  // Function to flush the log buffer to Convex
  const flushLogBuffer = async () => {
    if (!taskRunId) {
      return;
    }

    // Nothing new to flush
    if (terminal.scrollback.length === 0) {
      return;
    }

    try {
      // Join all pending chunks since last flush
      const pendingData = terminal.scrollback.join("");
      // Clear the in-memory buffer so that only new data is captured next time
      terminal.scrollback = [];

      // Split data into chunks of ~500KB to stay well under 1MB limit
      const CHUNK_SIZE = 500 * 1024; // 500KB per chunk
      const chunks: string[] = [];

      for (let i = 0; i < pendingData.length; i += CHUNK_SIZE) {
        chunks.push(pendingData.slice(i, i + CHUNK_SIZE));
      }

      // Append each chunk - Convex will automatically add _creationTime
      for (const chunk of chunks) {
        await convex.mutation(api.taskRunLogChunks.appendChunkPublic, {
          taskRunId: taskRunId as Id<"taskRuns">,
          content: chunk,
        });
      }
    } catch (error) {
      console.error("Failed to append log chunks to Convex:", error);
    }
  };

  ptyProcess.onData((data) => {
    headlessTerminal.write(data);
    io.emit("terminal-output", { terminalId, data });

    // Save data to scrollback for incremental persistence
    terminal.scrollback.push(data);
    if (terminal.scrollback.length > terminal.maxScrollbackLines) {
      // Remove oldest entry to cap memory usage
      terminal.scrollback.shift();
    }

    // Debounce saving to Convex
    if (taskRunId) {
      // Clear any existing debounce timer
      if (terminal.logDebounceTimer) {
        clearTimeout(terminal.logDebounceTimer);
      }

      // Set a new debounce timer (100ms)
      terminal.logDebounceTimer = setTimeout(() => {
        flushLogBuffer();
      }, 100);
    }
  });

  ptyProcess.onExit(async ({ exitCode, signal }) => {
    console.log(
      `Terminal ${terminalId} exited with code ${exitCode} and signal ${signal}`
    );

    // Flush any remaining logs before exit
    if (terminal.logDebounceTimer) {
      clearTimeout(terminal.logDebounceTimer);
    }
    await flushLogBuffer();

    // Clean up the terminal from global storage
    // globalTerminals.delete(terminalId);
    console.log(`Terminal ${terminalId} removed from globalTerminals`);

    io.emit("terminal-exit", { terminalId, exitCode, signal });
  });

  io.emit("terminal-created", { terminalId });
  console.log(`Global terminal ${terminalId} created`);

  return terminal;
}
