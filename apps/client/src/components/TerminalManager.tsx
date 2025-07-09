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
    if (!terminalRef.current) return;

    // If this terminal has already been attached to a DOM element in the past
    // we simply move that element into the new container instead of trying to
    // call `xterm.open` a second time.  Calling `open` twice on the same
    // xterm instance is a no-op and, in some versions, results in the terminal
    // not rendering at all after it has been re-mounted.  By re-parenting the
    // previously attached element we preserve the terminal’s state while
    // ensuring it is visible in the newly mounted view.

    if (terminal.elementRef) {
      // If the previous container is different from the one React just
      // rendered we try to move the xterm DOM node.  We need to make sure we
      // don’t create an invalid DOM hierarchy (e.g. appending an ancestor
      // into its own descendant).

      const prev = terminal.elementRef;
      const next = terminalRef.current;

      if (prev !== next) {
        // Guard against cycles – only move when it’s safe.
        if (!prev.contains(next) && !next.contains(prev)) {
          next.appendChild(prev);
          console.log(
            `[TerminalView] Re-attached existing terminal element for ${terminal.id}`
          );
        } else {
          // Fallback: perform a fresh mount.
          prev.innerHTML = "";
          terminal.xterm.open(next);
          console.log(
            `[TerminalView] Performed fallback open for terminal ${terminal.id}`
          );
        }

        // Update reference so we know the new container.
        terminal.elementRef = next;
      }
    } else {
      // First time mounting – perform the initial `open`.
      terminal.xterm.open(terminalRef.current);
      terminal.elementRef = terminalRef.current;
      console.log(
        `[TerminalView] Initial open performed for terminal ${terminal.id}`
      );
    }

    isAttachedRef.current = true;

    terminal.fitAddon.fit();

    const handleResize = () => {
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

      // Extra scheduled fits when a tab becomes active in case it was hidden
      // (display:none) previously.
      requestAnimationFrame(() => terminal.fitAddon.fit());
      requestAnimationFrame(() => terminal.fitAddon.fit());
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
