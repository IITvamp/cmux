import { useEffect, useRef } from "react";
import { useTerminal } from "../hooks/useTerminal";
import "./SingleTerminal.css";

export function SingleTerminal() {
  const { terminal, isReady } = useTerminal({
    name: "Single Terminal",
    autoCreate: true,
  });
  const terminalRef = useRef<HTMLDivElement>(null);
  const isAttachedRef = useRef(false);

  useEffect(() => {
    if (!terminal || !terminalRef.current || isAttachedRef.current) return;

    terminal.xterm.open(terminalRef.current);
    isAttachedRef.current = true;
    terminal.elementRef = terminalRef.current;
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
  }, [terminal, isReady]);

  useEffect(() => {
    if (terminal?.xterm) {
      terminal.xterm.focus();
    }
  }, [terminal]);

  if (!isReady) {
    return <div className="single-terminal-loading">Loading terminal...</div>;
  }

  return (
    <div className="single-terminal">
      <div
        ref={terminalRef}
        className="single-terminal-content"
      />
    </div>
  );
}