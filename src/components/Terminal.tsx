import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useMemo } from "react";
import { Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../shared/socket-schemas";
import { useXTerm } from "./xterm/use-xterm";

interface TerminalProps {
  terminalId: string;
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
}

export function Terminal({ terminalId, socket }: TerminalProps) {
  const fitAddon = useMemo(() => new FitAddon(), []);
  const webLinksAddon = useMemo(() => new WebLinksAddon(), []);
  const addons = useMemo(
    () => [fitAddon, webLinksAddon],
    [fitAddon, webLinksAddon]
  );

  const { ref: terminalRef, instance: terminal } = useXTerm({
    addons,
  });

  useEffect(() => {
    if (!terminal || !socket) return;

    const handleOutput = ({
      terminalId: id,
      data,
    }: Parameters<ServerToClientEvents["terminal-output"]>[0]) => {
      if (id === terminalId) {
        terminal.write(data);
      }
    };

    const handleExit = ({
      terminalId: id,
      exitCode,
    }: Parameters<ServerToClientEvents["terminal-exit"]>[0]) => {
      if (id === terminalId) {
        terminal.write(`\r\n[Process exited with code ${exitCode}]\r\n`);
      }
    };

    socket.on("terminal-output", handleOutput);
    socket.on("terminal-exit", handleExit);

    terminal.onData((data) => {
      socket.emit("terminal-input", { terminalId, data });
    });

    terminal.onResize(({ cols, rows }) => {
      socket.emit("resize", { terminalId, cols, rows });
    });

    terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      // Command+Backspace to delete from cursor to beginning of line (like ctrl+u)
      if (event.metaKey && event.key === "Backspace") {
        socket.emit("terminal-input", { terminalId, data: "\x15" });
        event.preventDefault();
        return false;
      }

      // Command+K to clear terminal
      if (event.metaKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        socket.emit("terminal-input", { terminalId, data: "\x0c" });
        return false;
      }

      return true;
    });

    const handleResize = () => {
      if (fitAddon) {
        fitAddon.fit();
      }
    };
    fitAddon.fit();

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      socket.off("terminal-output", handleOutput);
      socket.off("terminal-exit", handleExit);
      terminal.dispose();
    };
  }, [terminalId, socket, terminal, fitAddon]);

  return (
    <div
      ref={terminalRef}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#1e1e1e",
      }}
    />
  );
}
