import { DEFAULT_TERMINAL_CONFIG } from "@coderouter/shared/terminal-config";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal as XTerm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { TerminalInstance } from "./TerminalContext";
import { TerminalContext } from "./TerminalContext";
import { useSocket } from "./socket/use-socket";

interface TerminalContextProviderProps {
  children: React.ReactNode;
}

export const TerminalContextProvider: React.FC<
  TerminalContextProviderProps
> = ({ children }) => {
  const [terminals, setTerminals] = useState<Map<string, TerminalInstance>>(
    new Map()
  );
  const { socket } = useSocket();
  const nextTerminalNumber = useRef(1);
  const terminalsRef = useRef<Map<string, TerminalInstance>>(new Map());

  useEffect(() => {
    if (!socket) return;

    socket.on("terminal-created", ({ terminalId }: { terminalId: string }) => {
      console.log("Terminal created on server:", terminalId);

      // Check if we already have this terminal
      if (terminalsRef.current.has(terminalId)) {
        console.log("Terminal already exists:", terminalId);
        return;
      }

      const terminalName = `Terminal ${nextTerminalNumber.current}`;
      nextTerminalNumber.current++;

      const xterm = new XTerm(DEFAULT_TERMINAL_CONFIG);

      const fitAddon = new FitAddon();
      xterm.loadAddon(fitAddon);
      xterm.loadAddon(new WebLinksAddon());

      const newTerminal: TerminalInstance = {
        id: terminalId,
        name: terminalName,
        xterm,
        fitAddon,
        elementRef: null,
      };

      // Update ref immediately to ensure it's available for subsequent events
      terminalsRef.current = new Map(terminalsRef.current);
      terminalsRef.current.set(terminalId, newTerminal);

      setTerminals((prev) => {
        const newMap = new Map(prev);
        newMap.set(terminalId, newTerminal);
        return newMap;
      });

      xterm.onData((data) => {
        socket?.emit("terminal-input", { terminalId, data });
      });

      xterm.onResize(({ cols, rows }) => {
        console.log("xterm.onResize (socket.emit)", { cols, rows });
        socket?.emit("resize", { terminalId, cols, rows });
      });

      xterm.attachCustomKeyEventHandler((event: KeyboardEvent) => {
        if (event.metaKey && event.key === "Backspace") {
          socket?.emit("terminal-input", {
            terminalId,
            data: "\x15",
          });
          event.preventDefault();
          return false;
        }

        if (event.metaKey && event.key.toLowerCase() === "k") {
          event.preventDefault();
          socket?.emit("terminal-input", {
            terminalId,
            data: "\x0c",
          });
          return false;
        }

        return true;
      });
    });

    socket.on(
      "terminal-output",
      ({ terminalId, data }: { terminalId: string; data: string }) => {
        const terminal = terminalsRef.current.get(terminalId);
        if (terminal) {
          terminal.xterm.write(data);
        }
      }
    );

    socket.on(
      "terminal-exit",
      ({ terminalId, exitCode }: { terminalId: string; exitCode: number }) => {
        const terminal = terminalsRef.current.get(terminalId);
        if (terminal) {
          terminal.xterm.write(
            `\r\n[Process exited with code ${exitCode}]\r\n`
          );
        }
      }
    );

    socket.on("terminal-clear", ({ terminalId }: { terminalId: string }) => {
      const terminal = terminalsRef.current.get(terminalId);
      if (terminal) {
        terminal.xterm.clear();
      }
    });

    socket.on(
      "terminal-restore",
      ({ terminalId, data }: { terminalId: string; data: string }) => {
        const terminal = terminalsRef.current.get(terminalId);
        if (terminal) {
          // Clear and restore terminal state in one operation
          terminal.xterm.reset();
          terminal.xterm.write(data);
        }
      }
    );

    socket.on("terminal-closed", ({ terminalId }: { terminalId: string }) => {
      const terminal = terminalsRef.current.get(terminalId);
      if (terminal) {
        terminal.xterm.dispose();
        // Update ref immediately
        terminalsRef.current = new Map(terminalsRef.current);
        terminalsRef.current.delete(terminalId);
      }

      setTerminals((prev) => {
        const newTerminals = new Map(prev);
        newTerminals.delete(terminalId);
        return newTerminals;
      });
    });

    return () => {
      // Clean up socket event listeners
      socket.off("terminal-created");
      socket.off("terminal-output");
      socket.off("terminal-exit");
      socket.off("terminal-clear");
      socket.off("terminal-restore");
      socket.off("terminal-closed");

      // Dispose terminals
      terminalsRef.current.forEach((terminal) => {
        terminal.xterm.dispose();
      });
      terminalsRef.current.clear();
    };
  }, [socket]);

  const createTerminal = useCallback(
    (id?: string): string => {
      if (!id) {
        id = crypto.randomUUID();
      }
      // Request server to create a new terminal
      socket?.emit("create-terminal", { cols: 80, rows: 24, id });
      return id;
    },
    [socket]
  );

  const removeTerminal = useCallback(
    (id: string) => {
      const terminal = terminalsRef.current.get(id);

      if (terminal) {
        terminal.xterm.dispose();
        socket?.emit("close-terminal", { terminalId: id });

        // Update ref immediately
        terminalsRef.current = new Map(terminalsRef.current);
        terminalsRef.current.delete(id);

        setTerminals((prev) => {
          const newTerminals = new Map(prev);
          newTerminals.delete(id);
          return newTerminals;
        });
      }
    },
    [socket]
  );

  const getTerminal = useCallback(
    (id: string): TerminalInstance | undefined => {
      return terminals.get(id);
    },
    [terminals]
  );

  const updateTerminal = useCallback(
    (id: string, updates: Partial<TerminalInstance>) => {
      setTerminals((prev) => {
        const newTerminals = new Map(prev);
        const terminal = newTerminals.get(id);

        if (terminal) {
          newTerminals.set(id, { ...terminal, ...updates });
        }

        return newTerminals;
      });
    },
    []
  );

  const contextValue = {
    terminals,
    createTerminal,
    removeTerminal,
    getTerminal,
    updateTerminal,
  };

  return (
    <TerminalContext.Provider value={contextValue}>
      {children}
    </TerminalContext.Provider>
  );
};
