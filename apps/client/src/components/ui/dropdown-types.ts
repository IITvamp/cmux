import { Code2, Code, Folder } from "lucide-react";

export const editorIcons = {
  "vscode-remote": Code2,
  "vscode": Code2,
  "cursor": Code,
  "windsurf": Code,
  "finder": Folder,
} as const;

export type EditorType = keyof typeof editorIcons;