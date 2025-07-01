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
  terminals: TerminalInstance[];
  activeTerminalId: string | null;
  setActiveTerminalId: (id: string | null) => void;
  createNewTerminal: () => void;
  closeTerminal: (id: string) => void;
}

export const TerminalContext = createContext<TerminalContextType | null>(null);