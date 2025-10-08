import Editor from "@monaco-editor/react";
import { useTheme } from "@/components/theme/use-theme";
import { useState } from "react";

interface VSCodePanelProps {
  className?: string;
}

export function VSCodePanel({ className }: VSCodePanelProps) {
  const { theme } = useTheme();
  const [content, setContent] = useState<string>(
    '// Welcome to VSCode Editor\n// This is an independent editor instance\n\nconsole.log("Hello from VSCode!");'
  );

  return (
    <div className={className}>
      <Editor
        height="100%"
        defaultLanguage="typescript"
        value={content}
        onChange={(value) => setContent(value || "")}
        theme={theme === "dark" ? "vs-dark" : "light"}
        options={{
          minimap: { enabled: true },
          fontSize: 14,
          lineNumbers: "on",
          roundedSelection: false,
          scrollBeyondLastLine: false,
          readOnly: false,
          automaticLayout: true,
        }}
      />
    </div>
  );
}
