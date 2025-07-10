import AnsiToHtml from "ansi-to-html";
import React, { useEffect, useMemo, useState } from "react";
import { useSocket } from "../contexts/socket/use-socket";

interface GitDiffViewProps {
  workspacePath: string;
  className?: string;
}

export const GitDiffView: React.FC<GitDiffViewProps> = ({
  workspacePath,
  className = "",
}) => {
  const { socket } = useSocket();
  const [diffContent, setDiffContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ansiToHtml = useMemo(
    () =>
      new AnsiToHtml({
        fg: "#e4e4e4",
        bg: "#1e1e1e",
        newline: true,
        escapeXML: true,
        colors: {
          0: "#000000",
          1: "#ff5555",
          2: "#50fa7b",
          3: "#f1fa8c",
          4: "#bd93f9",
          5: "#ff79c6",
          6: "#8be9fd",
          7: "#f8f8f2",
        },
      }),
    []
  );

  useEffect(() => {
    if (!socket) return;

    const requestGitDiff = () => {
      setLoading(true);
      setError(null);
      socket.emit("git-full-diff", { workspacePath });
    };

    socket.on("git-full-diff-response", (data) => {
      setLoading(false);
      if (data.error) {
        setError(data.error);
      } else {
        setDiffContent(data.diff);
      }
    });

    socket.on("git-file-changed", (data) => {
      if (data.workspacePath === workspacePath) {
        requestGitDiff();
      }
    });

    requestGitDiff();

    return () => {
      socket.off("git-full-diff-response");
      socket.off("git-file-changed");
    };
  }, [workspacePath, socket]);

  const htmlContent = useMemo(() => {
    if (!diffContent) return "";
    return ansiToHtml.toHtml(diffContent);
  }, [diffContent, ansiToHtml]);

  if (loading && !diffContent) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="text-neutral-500">Loading git diff...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-neutral-900 ${className}`}>
      <div className="flex-1 overflow-auto p-2">
        {diffContent ? (
          <div
            className="text-xs font-mono whitespace-pre"
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              fontFamily: "monospace",
            }}
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        ) : (
          <div className="text-neutral-400 text-sm py-8 text-center">
            No changes to display
          </div>
        )}
      </div>
    </div>
  );
};
