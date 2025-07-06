import { useEffect, useRef, useState } from "react";
import type { TerminalInstance } from "../contexts/TerminalContext";
import { useTerminals } from "../hooks/useTerminals";
import "./TerminalManager.css";

export function TerminalManager() {
  const { terminals, createTerminal, removeTerminal } = useTerminals();
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const hasInitializedRef = useRef(false);

  // Only run once on mount to select first terminal if any exist
  useEffect(() => {
    if (!hasInitializedRef.current && terminals.size > 0 && !activeTerminalId) {
      console.log("initializing");
      const firstTerminalId = Array.from(terminals.keys())[0];
      setActiveTerminalId(firstTerminalId);
      hasInitializedRef.current = true;
    }
  }, [terminals.size, activeTerminalId, terminals]);

  const handleCreateTerminal = () => {
    const newTerminalId = createTerminal();
    setActiveTerminalId(newTerminalId);
  };

  const handleCloseTerminal = (terminalId: string) => {
    removeTerminal(terminalId);
    const terminalIds = Array.from(terminals.keys()).filter(
      (id) => id !== terminalId
    );
    if (terminalIds.length > 0) {
      setActiveTerminalId(terminalIds[terminalIds.length - 1]);
    } else {
      setActiveTerminalId(null);
    }
  };

  const terminalsArray = Array.from(terminals.values());

  return (
    <div className="terminal-manager">
      <div className="terminal-tabs">
        {terminalsArray.map((terminal) => (
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
                handleCloseTerminal(terminal.id);
              }}
              aria-label="Close terminal"
            >
              ×
            </button>
          </div>
        ))}
        <button
          className="new-terminal-btn"
          onClick={handleCreateTerminal}
          aria-label="New terminal"
        >
          +
        </button>
      </div>
      <div className="terminal-content">
        {terminalsArray.map((terminal) => (
          <TerminalView
            key={terminal.id}
            terminal={terminal}
            isActive={activeTerminalId === terminal.id}
          />
        ))}
        {terminals.size === 0 && (
          <div className="no-terminals">
            <p>No terminals open</p>
            <button onClick={handleCreateTerminal}>Create Terminal</button>
          </div>
        )}
      </div>
    </div>
  );
}

interface TerminalViewProps {
  terminal: TerminalInstance;
  isActive: boolean;
}

export function TerminalView({ terminal, isActive }: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const isAttachedRef = useRef(false);

  useEffect(() => {
    if (!terminalRef.current || isAttachedRef.current) return;

    terminal.xterm.open(terminalRef.current);
    isAttachedRef.current = true;

    if (terminal.elementRef !== terminalRef.current) {
      terminal.elementRef = terminalRef.current;
    }

    terminal.fitAddon.fit();

    const handleResize = () => {
      console.log("resizing");
      if (terminal.fitAddon) {
        terminal.fitAddon.fit();
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(terminalRef.current);
    window.addEventListener("resize", handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [terminal]);

  useEffect(() => {
    if (isActive && terminal.xterm) {
      terminal.fitAddon.fit();
      terminal.xterm.focus();
    }
  }, [isActive, terminal]);

  return (
    <div className={`w-full h-full`}>
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
