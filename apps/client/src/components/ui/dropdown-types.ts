import { Code2, Code, Folder, TerminalSquare, Hammer } from "lucide-react";

export const editorIcons = {
  "vscode-remote": Code2,
  "vscode": Code2,
  "cursor": Code,
  "windsurf": Code,
  "finder": Folder,
  "terminal": TerminalSquare,
  "iterm": TerminalSquare,
  "ghostty": TerminalSquare,
  "alacritty": TerminalSquare,
  "xcode": Hammer,
} as const;

export type EditorType = keyof typeof editorIcons;
