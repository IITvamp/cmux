import { PersistentWebView } from "@/components/persistent-webview";
import { Code2, ExternalLink, Settings } from "lucide-react";
import { useCallback, useState } from "react";

interface VSCodeEditorProps {
  workspaceUrl?: string;
  className?: string;
  onWorkspaceUrlChange?: (url: string) => void;
}

export function VSCodeEditor({ workspaceUrl, className, onWorkspaceUrlChange }: VSCodeEditorProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState(workspaceUrl || "");

  const onLoad = useCallback(() => {
    setIsLoaded(true);
    console.log("VS Code editor loaded");
  }, []);

  const onError = useCallback((error: Error) => {
    console.error("Failed to load VS Code editor:", error);
  }, []);

  const handleOpenNewWindow = useCallback(() => {
    if (workspaceUrl) {
      window.open(workspaceUrl, "_blank");
    }
  }, [workspaceUrl]);

  const handleSaveUrl = useCallback(() => {
    if (onWorkspaceUrlChange) {
      onWorkspaceUrlChange(urlInput);
    }
    setShowUrlInput(false);
  }, [urlInput, onWorkspaceUrlChange]);

  const handleToggleUrlInput = useCallback(() => {
    setShowUrlInput((prev) => !prev);
  }, []);

  return (
    <div className={`relative flex flex-col bg-neutral-50 dark:bg-neutral-900 ${className || ""}`}>
      {/* Header */}
      <div className="flex flex-col bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              VS Code Editor
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleUrlInput}
              className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
              title="Configure workspace URL"
            >
              <Settings className="w-3 h-3" />
              <span>Configure</span>
            </button>
            {workspaceUrl && (
              <button
                type="button"
                onClick={handleOpenNewWindow}
                className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
                title="Open in new window"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Open in new window</span>
              </button>
            )}
          </div>
        </div>
        {showUrlInput && (
          <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900">
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              VS Code Workspace URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="http://localhost:8080 or https://your-vscode-server.com"
                className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleSaveUrl}
                className="px-4 py-1.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowUrlInput(false)}
                className="px-4 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              This workspace is independent of task-specific workspaces created by cmux.
            </p>
          </div>
        )}
      </div>

      {/* VS Code iframe */}
      <div className="flex-1 relative min-h-0">
        {workspaceUrl ? (
          <PersistentWebView
            persistKey="dashboard-vscode-editor"
            src={workspaceUrl}
            className="w-full h-full"
            iframeClassName="w-full h-full"
            sandbox="allow-downloads allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation allow-top-navigation-by-user-activation"
            allow="accelerometer; camera; encrypted-media; fullscreen; geolocation; gyroscope; magnetometer; microphone; midi; payment; usb; xr-spatial-tracking"
            retainOnUnmount
            onLoad={onLoad}
            onError={onError}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 p-8 max-w-2xl mx-auto">
            <Code2 className="w-12 h-12 mb-4 text-neutral-400" />
            <p className="text-base font-medium mb-2">VS Code Workspace Not Configured</p>
            <p className="text-sm text-center mb-4 text-neutral-400">
              To use the integrated VS Code editor, you need to provide a workspace URL.
            </p>
            <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4 w-full text-xs space-y-2">
              <p className="font-medium text-neutral-700 dark:text-neutral-300">Setup Instructions:</p>
              <ol className="list-decimal list-inside space-y-1 text-neutral-600 dark:text-neutral-400">
                <li>Run a local VS Code server or use a remote one</li>
                <li>Copy the workspace URL</li>
                <li>Click the "Show Editor" button and configure the URL</li>
              </ol>
              <p className="mt-3 text-neutral-500">
                Note: This VS Code instance is separate from the task-specific workspaces that cmux creates.
              </p>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {workspaceUrl && !isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-50/80 dark:bg-neutral-900/80">
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-1">
                <div
                  className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <div
                  className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
              <span className="text-sm text-neutral-500">Loading VS Code...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
