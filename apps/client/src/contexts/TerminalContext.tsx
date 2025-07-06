import { createContext } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

export interface TerminalInstance {
  id: string;
  name: string;
  xterm: XTerm;
  fitAddon: FitAddon;
  elementRef: HTMLDivElement | null;
}

export interface TerminalContextType {
  terminals: Map<string, TerminalInstance>;
  createTerminal: (id?: string, name?: string) => string;
  removeTerminal: (id: string) => void;
  getTerminal: (id: string) => TerminalInstance | undefined;
  updateTerminal: (id: string, updates: Partial<TerminalInstance>) => void;
}

export const TerminalContext = createContext<TerminalContextType | null>(null);