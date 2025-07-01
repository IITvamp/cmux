import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal as XTerm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  TerminalContext,
  type TerminalInstance,
} from "../contexts/TerminalContext";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../shared/socket-schemas";

export function TerminalManager() {
  const [terminals, setTerminals] = useState<TerminalInstance[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const socketRef = useRef<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);
  const terminalsRef = useRef<Map<string, TerminalInstance>>(new Map());

  useEffect(() => {
    const socket = io("http://localhost:3001") as Socket<
      ServerToClientEvents,
      ClientToServerEvents
    >;
    socketRef.current = socket;

    // Capture refs for cleanup
    const terminalsMap = terminalsRef.current;

    socket.on("connect", () => {
      console.log("Connected to terminal server");
      console.log("Socket ID:", socket.id);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from terminal server");
    });

    // Handle terminals created by any client
    socket.on("terminal-created", ({ terminalId }) => {
      console.log("Received terminal-created event:", terminalId);

      // Check if we already have this terminal
      if (terminalsRef.current.has(terminalId)) {
        console.log("Terminal already exists in ref:", terminalId);
        return;
      }

      // Create xterm instance
      const xterm = new XTerm({
        fontSize: 12,
        fontFamily:
          "Menlo, Monaco, operator mono,SFMono-Regular,Consolas,Liberation Mono,Menlo,monospace",
        theme: {
          background: "#1e1e1e",
          foreground: "#d4d4d4",
          cursor: "#aeafad",
          black: "#000000",
          red: "#cd3131",
          green: "#0dbc79",
          yellow: "#e5e510",
          blue: "#2472c8",
          magenta: "#bc3fbc",
          cyan: "#11a8cd",
          white: "#e5e5e5",
          brightBlack: "#666666",
          brightRed: "#f14c4c",
          brightGreen: "#23d18b",
          brightYellow: "#f5f543",
          brightBlue: "#3b8eea",
          brightMagenta: "#d670d6",
          brightCyan: "#29b8db",
          brightWhite: "#e5e5e5",
        },
        cursorStyle: "bar",
        cursorBlink: true,
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      xterm.loadAddon(fitAddon);
      xterm.loadAddon(webLinksAddon);

      const terminalNumber =
        Array.from(terminalsRef.current.values()).length + 1;

      // Set up event handlers for the terminal
      xterm.onData((data) => {
        socketRef.current?.emit("terminal-input", { terminalId, data });
      });

      xterm.onResize(({ cols, rows }) => {
        socketRef.current?.emit("resize", { terminalId, cols, rows });
      });

      // Custom key handler
      xterm.attachCustomKeyEventHandler((event: KeyboardEvent) => {
        // Command+Backspace to delete from cursor to beginning of line
        if (event.metaKey && event.key === "Backspace") {
          socketRef.current?.emit("terminal-input", {
            terminalId,
            data: "\x15",
          });
          event.preventDefault();
          return false;
        }

        // Command+K to clear terminal
        if (event.metaKey && event.key.toLowerCase() === "k") {
          event.preventDefault();
          socketRef.current?.emit("terminal-input", {
            terminalId,
            data: "\x0c",
          });
          return false;
        }

        return true;
      });

      const terminal: TerminalInstance = {
        id: terminalId,
        name: `Terminal ${terminalNumber}`,
        xterm,
        fitAddon,
        elementRef: null,
      };

      terminalsRef.current.set(terminalId, terminal);

      setTerminals((prev) => {
        // Check if terminal already exists in state
        if (prev.some((t) => t.id === terminalId)) {
          console.log("Terminal already exists in state:", terminalId);
          return prev;
        }

        // Always set the new terminal as active
        setActiveTerminalId(() => terminalId);

        return [...prev, terminal];
      });
    });

    // Handle terminal output
    socket.on("terminal-output", ({ terminalId, data }) => {
      const terminal = terminalsRef.current.get(terminalId);
      if (terminal) {
        terminal.xterm.write(data);
      } else {
        console.warn("Received output for unknown terminal:", terminalId);
      }
    });

    // Handle terminal exit
    socket.on("terminal-exit", ({ terminalId, exitCode }) => {
      const terminal = terminalsRef.current.get(terminalId);
      if (terminal) {
        terminal.xterm.write(`\r\n[Process exited with code ${exitCode}]\r\n`);
      }
    });

    // Handle terminals closed by any client
    socket.on("terminal-closed", ({ terminalId }) => {
      const terminal = terminalsRef.current.get(terminalId);
      if (terminal) {
        terminal.xterm.dispose();
        terminalsRef.current.delete(terminalId);
      }

      setTerminals((prev) => {
        const newTerminals = prev.filter((t) => t.id !== terminalId);

        setActiveTerminalId((currentActiveId) => {
          if (currentActiveId === terminalId && newTerminals.length > 0) {
            return newTerminals[newTerminals.length - 1].id;
          } else if (newTerminals.length === 0) {
            return null;
          }
          return currentActiveId;
        });

        return newTerminals;
      });
    });

    return () => {
      // Dispose all terminals using captured ref
      terminalsMap.forEach((terminal) => {
        terminal.xterm.dispose();
      });
      terminalsMap.clear();

      socket.disconnect();
    };
  }, []);

  // useEffect(() => {
  //   // emit resize event to server
  //   if (!socketRef.current || !activeTerminalId) return;
  //   const terminal = terminalsRef.current.get(activeTerminalId);
  //   if (!terminal) return;
  //   socketRef.current.emit("resize", {
  //     terminalId: activeTerminalId,
  //     cols: terminal.xterm.cols,
  //     rows: terminal.xterm.rows,
  //   });
  // }, [activeTerminalId]);

  const createNewTerminal = () => {
    if (!socketRef.current) return;
    socketRef.current.emit("create-terminal", { cols: 80, rows: 24 });
  };

  const closeTerminal = (terminalId: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit("close-terminal", { terminalId });
  };

  return (
    <TerminalContext.Provider
      value={{
        terminals,
        activeTerminalId,
        setActiveTerminalId,
        createNewTerminal,
        closeTerminal,
      }}
    >
      <div className="terminal-manager">
        <div className="terminal-tabs">
          {terminals.map((terminal) => (
            <div
              key={terminal.id}
              className={`terminal-tab ${
                activeTerminalId === terminal.id ? "active" : ""
              }`}
              onClick={() => setActiveTerminalId(terminal.id)}
            >
              <span className="tab-name">{terminal.name}</span>
              <button
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTerminal(terminal.id);
                }}
                aria-label="Close terminal"
              >
                ×
              </button>
            </div>
          ))}
          <button
            className="new-terminal-btn"
            onClick={createNewTerminal}
            aria-label="New terminal"
          >
            +
          </button>
        </div>
        <div className="terminal-content">
          {terminals.map((terminal) => (
            <TerminalView
              key={terminal.id}
              terminal={terminal}
              isActive={activeTerminalId === terminal.id}
            />
          ))}
          {terminals.length === 0 && (
            <div className="no-terminals">
              <p>No terminals open</p>
              <button onClick={createNewTerminal}>Create Terminal</button>
            </div>
          )}
        </div>
      </div>
    </TerminalContext.Provider>
  );
}

interface TerminalViewProps {
  terminal: TerminalInstance;
  isActive: boolean;
}

function TerminalView({ terminal, isActive }: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Open terminal in the DOM element
    terminal.xterm.open(terminalRef.current);
    terminal.elementRef = terminalRef.current;

    // Initial fit
    terminal.fitAddon.fit();

    const handleResize = () => {
      if (terminal.fitAddon) {
        terminal.fitAddon.fit();
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [terminal]);

  useEffect(() => {
    if (isActive && terminal.xterm) {
      terminal.fitAddon.fit();
      terminal.xterm.focus();
    }
  }, [isActive, terminal]);

  return (
    <div className={`terminal-pane ${isActive ? "active" : ""}`}>
      <div
        ref={terminalRef}
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#1e1e1e",
        }}
      />
    </div>
  );
}
