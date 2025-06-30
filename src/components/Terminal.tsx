import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useMemo } from "react";
import { Socket } from "socket.io-client";
import { useXTerm } from "./xterm/use-xterm";

interface TerminalProps {
  terminalId: string;
  socket: Socket | null;
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
    }: {
      terminalId: string;
      data: string;
    }) => {
      if (id === terminalId) {
        terminal.write(data);
      }
    };

    const handleExit = ({
      terminalId: id,
      exitCode,
    }: {
      terminalId: string;
      exitCode: number;
    }) => {
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
