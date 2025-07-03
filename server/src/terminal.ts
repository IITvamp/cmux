import { SerializeAddon } from "@xterm/addon-serialize";
import xtermHeadless from "@xterm/headless";
const { Terminal } = xtermHeadless;
import { spawn, type IPty } from "node-pty";
import { platform } from "node:os";
import type { Server } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents, InterServerEvents, SocketData } from "../../src/shared/socket-schemas.ts";

export interface GlobalTerminal {
  pty: IPty;
  scrollback: string[];
  maxScrollbackLines: number;
  headlessTerminal: xtermHeadless.Terminal;
  serializeAddon: SerializeAddon;
}

const MAX_SCROLLBACK_LINES = 100000;

export function createTerminal(
  terminalId: string,
  globalTerminals: Map<string, GlobalTerminal>,
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  options: {
    cols?: number;
    rows?: number;
    cwd?: string;
    env?: Record<string, string>;
    command?: string;
    args?: string[];
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
    args = []
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
  };

  globalTerminals.set(terminalId, terminal);

  ptyProcess.onData((data) => {
    headlessTerminal.write(data);
    io.emit("terminal-output", { terminalId, data });
  });

  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log(`Terminal ${terminalId} exited with code ${exitCode} and signal ${signal}`);
    io.emit("terminal-exit", { terminalId, exitCode, signal });
  });

  io.emit("terminal-created", { terminalId });
  console.log(`Global terminal ${terminalId} created`);
  
  return terminal;
}