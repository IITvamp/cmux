import { api } from "@coderouter/convex/api";
import type { Id } from "@coderouter/convex/dataModel";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@coderouter/shared";
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
  logBuffer?: string;
  logDebounceTimer?: NodeJS.Timeout;
}

const MAX_SCROLLBACK_LINES = 100000;

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
    cols = 80,
    rows = 24,
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
    logBuffer: "",
  };

  globalTerminals.set(terminalId, terminal);

  // Function to flush the log buffer to Convex
  const flushLogBuffer = async () => {
    const disabled = true;
    if (disabled) {
      return;
    }
    if (!taskRunId || !terminal.logBuffer) {
      return;
    }

    const bufferToFlush = terminal.logBuffer;
    terminal.logBuffer = "";

    try {
      await convex.mutation(api.taskRuns.appendLogPublic, {
        id: taskRunId as Id<"taskRuns">,
        content: bufferToFlush,
      });
    } catch (error) {
      console.error("Failed to append log to Convex:", error);
      // Re-add the buffer if the mutation failed
      terminal.logBuffer = bufferToFlush + terminal.logBuffer;
    }
  };

  ptyProcess.onData((data) => {
    headlessTerminal.write(data);
    io.emit("terminal-output", { terminalId, data });

    // Buffer the output for Convex logging
    if (taskRunId) {
      terminal.logBuffer = (terminal.logBuffer || "") + data;

      // Clear any existing debounce timer
      if (terminal.logDebounceTimer) {
        clearTimeout(terminal.logDebounceTimer);
      }

      // Set a new debounce timer (100ms as requested)
      terminal.logDebounceTimer = setTimeout(() => {
        flushLogBuffer();
      }, 100);
    }
  });

  ptyProcess.onExit(async ({ exitCode, signal }) => {
    console.log(
      `Terminal ${terminalId} exited with code ${exitCode} and signal ${signal}`
    );

    // Flush any remaining buffered logs before exit
    if (terminal.logDebounceTimer) {
      clearTimeout(terminal.logDebounceTimer);
    }
    if (terminal.logBuffer) {
      await flushLogBuffer();
    }

    io.emit("terminal-exit", { terminalId, exitCode, signal });
  });

  io.emit("terminal-created", { terminalId });
  console.log(`Global terminal ${terminalId} created`);

  return terminal;
}
