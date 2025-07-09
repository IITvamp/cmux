import type { TerminalInstance } from "@/contexts/TerminalContext";
import { useSocket } from "@/contexts/socket/use-socket";
import clsx from "clsx";
import { useEffect, useRef } from "react";

export interface TerminalViewProps {
  terminal: TerminalInstance;
  isActive: boolean;
}

export function TerminalView({ terminal, isActive }: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const isAttachedRef = useRef(false);
  const { socket } = useSocket();

  useEffect(() => {
    if (!terminalRef.current) return;

    // If this terminal has already been attached to a DOM element in the past
    // we simply move that element into the new container instead of trying to
    // call `xterm.open` a second time.  Calling `open` twice on the same
    // xterm instance is a no-op and, in some versions, results in the terminal
    // not rendering at all after it has been re-mounted.  By re-parenting the
    // previously attached element we preserve the terminal's state while
    // ensuring it is visible in the newly mounted view.
    if (terminal.elementRef) {
      // If the previous container is different from the one React just
      // rendered we try to move the xterm DOM node.  We need to make sure we
      // don't create an invalid DOM hierarchy (e.g. appending an ancestor
      // into its own descendant).
      const prev = terminal.elementRef;
      const next = terminalRef.current;

      if (prev !== next) {
        // Guard against cycles – only move when it's safe.
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
        console.log("call fit first");
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
    if (!isActive || !terminal.xterm || !socket) return;
    terminal.xterm.focus();
    terminal.fitAddon.fit();
    console.log(terminal.xterm.cols, terminal.xterm.rows);
  }, [isActive, terminal, socket]);

  return (
    <div className={clsx(`flex flex-col grow relative`, !isActive && "hidden")}>
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
