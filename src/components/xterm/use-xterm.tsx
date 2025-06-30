import {
  Terminal,
  type ITerminalAddon,
  type ITerminalInitOnlyOptions,
  type ITerminalOptions,
} from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";

export interface UseXTermProps {
  addons?: ITerminalAddon[];
  options?: ITerminalOptions & ITerminalInitOnlyOptions;
  listeners?: {
    onBinary?(data: string): void;
    onCursorMove?(): void;
    onData?(data: string): void;
    onKey?: (event: { key: string; domEvent: KeyboardEvent }) => void;
    onLineFeed?(): void;
    onScroll?(newPosition: number): void;
    onSelectionChange?(): void;
    onRender?(event: { start: number; end: number }): void;
    onResize?(event: { cols: number; rows: number }): void;
    onTitleChange?(newTitle: string): void;
    customKeyEventHandler?(event: KeyboardEvent): boolean;
  };
}

export function useXTerm({ options, addons, listeners }: UseXTermProps = {}) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const listenersRef = useRef<UseXTermProps["listeners"]>(listeners);
  const [terminalInstance, setTerminalInstance] = useState<Terminal | null>(
    null
  );

  // Keep the latest version of listeners without retriggering the effect
  useEffect(() => {
    listenersRef.current = listeners;
  }, [listeners]);

  useEffect(() => {
    const instance = new Terminal({
      fontFamily:
        "Menlo, Monaco, operator mono,SFMono-Regular,Consolas,Liberation Mono,Menlo,monospace",
      fontSize: 12,
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
      // cursorStyle: "underline",
      cursorStyle: "bar",
      cursorBlink: true,
      scrollback: 1000000,
      ...options,
    });

    // Load optional addons
    addons?.forEach((addon) => instance.loadAddon(addon));

    // Register event listeners from the ref
    const l = listenersRef.current;
    if (l?.onBinary) {
      instance.onBinary(l.onBinary);
    }
    if (l?.onCursorMove) {
      instance.onCursorMove(l.onCursorMove);
    }
    if (l?.onLineFeed) {
      instance.onLineFeed(l.onLineFeed);
    }
    if (l?.onScroll) {
      instance.onScroll(l.onScroll);
    }
    if (l?.onSelectionChange) {
      instance.onSelectionChange(l.onSelectionChange);
    }
    if (l?.onRender) {
      instance.onRender(l.onRender);
    }
    if (l?.onResize) {
      instance.onResize(l.onResize);
    }
    if (l?.onTitleChange) {
      instance.onTitleChange(l.onTitleChange);
    }
    if (l?.onKey) {
      instance.onKey(l.onKey);
    }
    if (l?.onData) {
      instance.onData(l.onData);
    }
    if (l?.customKeyEventHandler) {
      instance.attachCustomKeyEventHandler(l.customKeyEventHandler);
    }

    // Add keyboard shortcuts
    // instance.attachCustomKeyEventHandler((event: KeyboardEvent) => {
    //   // Command+Backspace to delete from cursor to beginning of line (like ctrl+u)
    //   if (event.metaKey && event.key === "Backspace") {
    //     // Send ctrl+u (0x15) to the backend by pasting it as user input
    //     // instance.paste("\x15", false);
    //     instance.write("\x1b[2K\r");
    //     event.preventDefault();
    //     return false;
    //   }

    //   // Command+K to clear terminal but keep current line
    //   if (event.metaKey && event.key.toLowerCase() === "k") {
    //     event.preventDefault();
    //     // Clear scrollback on the client
    //     instance.clear();
    //     // Send ctrl+l (0x0c) to backend so it refreshes the prompt
    //     // instance.paste("\x0c", false);
    //     return false;
    //   }

    //   return true;
    // });

    if (terminalRef.current) {
      instance.open(terminalRef.current);
      instance.focus();
    }

    setTerminalInstance(instance);

    return () => {
      instance.dispose();
      setTerminalInstance(null);
    };
  }, [options, addons]);

  return {
    ref: terminalRef,
    instance: terminalInstance,
  };
}
