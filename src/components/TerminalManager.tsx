import { useEffect, useRef, useState } from "react";
import type { TerminalInstance } from "../contexts/TerminalContext";
import { useTerminals } from "../hooks/useTerminals";
import "./TerminalManager.css";

export function TerminalManager() {
  const { terminals, createTerminal, removeTerminal } = useTerminals();
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);

  // useEffect(() => {
  //   if (terminals.size === 0) {
  //     createTerminal();
  //   }
  // }, [terminals.size, createTerminal]);

  useEffect(() => {
    if (activeTerminalId && !terminals.has(activeTerminalId)) {
      const terminalIds = Array.from(terminals.keys());
      if (terminalIds.length > 0) {
        setActiveTerminalId(terminalIds[terminalIds.length - 1]);
      } else {
        setActiveTerminalId(null);
      }
    } else if (!activeTerminalId && terminals.size > 0) {
      const firstTerminalId = Array.from(terminals.keys())[0];
      setActiveTerminalId(firstTerminalId);
    }
  }, [terminals, activeTerminalId]);

  const handleCreateTerminal = () => {
    createTerminal();
    // The terminal will be created asynchronously and added to the terminals map
    // The useEffect will handle setting it as active when it appears
  };

  const handleCloseTerminal = (terminalId: string) => {
    removeTerminal(terminalId);
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

function TerminalView({ terminal, isActive }: TerminalViewProps) {
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
