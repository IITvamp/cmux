import { Code2, Code, Folder, Terminal, FileCode2, SquareTerminal, Box } from "lucide-react";
import type { ComponentType } from "react";

export const applicationIcons: Record<string, ComponentType<{ className?: string }>> = {
  // Editors
  "vscode": Code2,
  "cursor": Code,
  "windsurf": Code,
  "finder": Folder,
  
  // Terminals
  "terminal": Terminal,
  "iterm": Terminal,
  "ghostty": SquareTerminal,
  "alacritty": Terminal,
  "gnome-terminal": Terminal,
  "konsole": Terminal,
  "xterm": Terminal,
  "cmd": Terminal,
  "powershell": Terminal,
  "wt": Terminal,
  
  // IDEs
  "xcode": FileCode2,
};

export function getApplicationIcon(appId: string): ComponentType<{ className?: string }> {
  return applicationIcons[appId] || Box;
}