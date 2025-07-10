import { api } from "@coderouter/convex/api";
import { type Id } from "@coderouter/convex/dataModel";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal as XTerm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useQuery } from "convex/react";
import { useEffect, useRef } from "react";

export interface RestoredTerminalViewProps {
  runId: string;
}

export function RestoredTerminalView({ runId }: RestoredTerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Fetch log chunks from Convex
  const logChunks = useQuery(api.taskRunLogChunks.getChunks, {
    taskRunId: runId as Id<"taskRuns">,
  });

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create xterm instance with same theme as TerminalView
    const xterm = new XTerm({
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
      fontSize: 12,
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
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
      cursorBlink: false,
      scrollback: 100000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);

    xterm.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(terminalRef.current);
    window.addEventListener("resize", handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      xterm.dispose();
    };
  }, []);

  // Write log chunks to terminal when they arrive
  useEffect(() => {
    if (!xtermRef.current || !logChunks) return;

    // Clear terminal before writing
    xtermRef.current.clear();

    // Concatenate all chunks to reconstruct the serialized data
    const serializedData = logChunks.map((chunk) => chunk.content).join("");

    // Write the serialized data to restore the terminal state
    if (serializedData) {
      xtermRef.current.write(serializedData);
    }
  }, [logChunks]);

  return (
    <div className="flex flex-col grow relative">
      <div
        ref={terminalRef}
        className="w-full h-full"
        style={{
          backgroundColor: "#1e1e1e",
        }}
      />
    </div>
  );
}
