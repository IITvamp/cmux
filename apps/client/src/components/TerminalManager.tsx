import { useEffect, useRef, useState } from "react";
import { useTerminals } from "../hooks/useTerminals";
import "./TerminalManager.css";
import { TerminalView } from "./TerminalView";

export function TerminalManager() {
  const { terminals, createTerminal, removeTerminal } = useTerminals();
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const hasInitializedRef = useRef(false);

  // Only run once on mount to select first terminal if any exist
  useEffect(() => {
    if (!hasInitializedRef.current && terminals.size > 0 && !activeTerminalId) {
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
