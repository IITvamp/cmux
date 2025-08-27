import { Code2, Code, Folder, TerminalSquare } from "lucide-react";

export const editorIcons = {
  "vscode-remote": Code2,
  "vscode": Code2,
  "cursor": Code,
  "windsurf": Code,
  "finder": Folder,
  "iterm": TerminalSquare,
  "terminal": TerminalSquare,
  "ghostty": TerminalSquare,
  "alacritty": TerminalSquare,
  "xcode": Code2,
} as const;

export type EditorType = keyof typeof editorIcons;