import { DiffEditor } from "@monaco-editor/react";
import { useTheme } from "@/components/theme/use-theme";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";
import type { Doc } from "@cmux/convex/dataModel";

interface GitDiffViewerProps {
  diffs: Doc<"gitDiffs">[];
  isLoading?: boolean;
}

interface FileGroup {
  filePath: string;
  status: Doc<"gitDiffs">["status"];
  additions: number;
  deletions: number;
  oldContent: string;
  newContent: string;
  patch?: string;
  isBinary: boolean;
}

export function GitDiffViewer({ diffs, isLoading }: GitDiffViewerProps) {
  const { theme } = useTheme();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Group diffs by file
  const fileGroups: FileGroup[] = diffs.map(diff => ({
    filePath: diff.filePath,
    status: diff.status,
    additions: diff.additions,
    deletions: diff.deletions,
    oldContent: diff.oldContent || "",
    newContent: diff.newContent || "",
    patch: diff.patch,
    isBinary: diff.isBinary,
  }));

  const selectedDiff = fileGroups.find(f => f.filePath === selectedFile);

  const getStatusColor = (status: Doc<"gitDiffs">["status"]) => {
    switch (status) {
      case "added":
        return "text-green-500";
      case "deleted":
        return "text-red-500";
      case "modified":
        return "text-yellow-500";
      case "renamed":
        return "text-blue-500";
      default:
        return "text-neutral-500";
    }
  };

  const getStatusLabel = (status: Doc<"gitDiffs">["status"]) => {
    switch (status) {
      case "added":
        return "A";
      case "deleted":
        return "D";
      case "modified":
        return "M";
      case "renamed":
        return "R";
      default:
        return "?";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-neutral-500 dark:text-neutral-400">
          Loading diffs...
        </div>
      </div>
    );
  }

  if (diffs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-neutral-500 dark:text-neutral-400">
          No changes to display
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* File list sidebar */}
      <div className="w-80 border-r border-neutral-200 dark:border-neutral-800 overflow-y-auto">
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-800">
          <div className="text-sm font-medium">
            {diffs.length} changed files
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            +{diffs.reduce((sum, d) => sum + d.additions, 0)} -{diffs.reduce((sum, d) => sum + d.deletions, 0)}
          </div>
        </div>
        
        <div className="p-2">
          {fileGroups.map((file) => (
            <button
              key={file.filePath}
              onClick={() => setSelectedFile(file.filePath)}
              className={cn(
                "w-full text-left px-2 py-1.5 rounded text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2",
                selectedFile === file.filePath && "bg-neutral-100 dark:bg-neutral-800"
              )}
            >
              <span className={cn("font-mono font-bold", getStatusColor(file.status))}>
                {getStatusLabel(file.status)}
              </span>
              <FileText className="w-3.5 h-3.5 text-neutral-400" />
              <div className="flex-1 truncate">
                <div className="truncate">{file.filePath}</div>
                <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  +{file.additions} -{file.deletions}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Diff viewer */}
      <div className="flex-1">
        {selectedDiff ? (
          selectedDiff.isBinary ? (
            <div className="flex items-center justify-center h-full text-neutral-500 dark:text-neutral-400">
              Binary file not shown
            </div>
          ) : (
            <DiffEditor
              original={selectedDiff.oldContent}
              modified={selectedDiff.newContent}
              language={getLanguageFromPath(selectedDiff.filePath)}
              theme={theme === "dark" ? "vs-dark" : "light"}
              options={{
                readOnly: true,
                renderSideBySide: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 12,
                wordWrap: "on",
                automaticLayout: true,
              }}
            />
          )
        ) : (
          <div className="flex items-center justify-center h-full text-neutral-500 dark:text-neutral-400">
            Select a file to view changes
          </div>
        )}
      </div>
    </div>
  );
}

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    md: "markdown",
    css: "css",
    scss: "scss",
    html: "html",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    py: "python",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    cpp: "cpp",
    cs: "csharp",
    php: "php",
    rb: "ruby",
    swift: "swift",
    kt: "kotlin",
    scala: "scala",
    sh: "shell",
    bash: "shell",
    sql: "sql",
    dockerfile: "dockerfile",
  };
  
  return languageMap[ext || ""] || "plaintext";
}