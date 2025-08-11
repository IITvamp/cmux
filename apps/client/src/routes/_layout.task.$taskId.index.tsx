import { api } from "@cmux/convex/api";
import { type Id } from "@cmux/convex/dataModel";
import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { Copy, GitBranch, Github, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MergeButton, type MergeMethod } from "@/components/MergeButton";
import { DiffEditor } from "@monaco-editor/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { editor } from "monaco-editor";

export const Route = createFileRoute("/_layout/task/$taskId/")({
  component: TaskDetailPage,
  loader: async (opts) => {
    await Promise.all([
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.taskRuns.getByTask, {
          taskId: opts.params.taskId as Id<"tasks">,
        })
      ),
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.tasks.getById, {
          id: opts.params.taskId as Id<"tasks">,
        })
      ),
      // opts.context.queryClient.ensureQueryData(
      //   convexQuery(api.taskDiffs.getLatestByTask, {
      //     taskId: opts.params.taskId as Id<"tasks">,
      //   })
      // ),
      // opts.context.queryClient.ensureQueryData(
      //   convexQuery(api.pullRequests.getByTask, {
      //     taskId: opts.params.taskId as Id<"tasks">,
      //   })
      // ),
    ]);
  },
});

function TaskDetailPage() {
  const { taskId } = Route.useParams();
  const [selectedFile, setSelectedFile] = useState<number>(0);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [showPRActions, setShowPRActions] = useState(false);

  const { data: task } = useQuery(
    convexQuery(api.tasks.getById, {
      id: taskId as Id<"tasks">,
    })
  );

  // Temporarily use null until API is available
  const taskDiff: any = null;
  const refetchDiff = () => Promise.resolve();
  
  const pullRequest: any = null;
  const refetchPR = () => Promise.resolve();
  
  const createOrUpdatePR = { 
    mutate: async (_args: any) => {},
  };
  const mergePR = { 
    mutate: async (_args: any) => {},
  };
  const updateDiffs = {
    mutate: async (_args: any) => {},
  };

  const handleCopyBranch = useCallback(() => {
    if (task?.branch) {
      navigator.clipboard.writeText(task.branch);
      toast.success("Branch name copied to clipboard");
    }
  }, [task?.branch]);

  const handleOpenPR = useCallback(async () => {
    if (!pullRequest) {
      await createOrUpdatePR.mutate({
        taskId: taskId as Id<"tasks">,
        isDraft: true,
      });
      await refetchPR();
    }
    setShowPRActions(true);
  }, [pullRequest, createOrUpdatePR, taskId, refetchPR]);

  const handleMerge = useCallback(async (method: MergeMethod) => {
    if (!pullRequest?._id) return;
    
    await mergePR.mutate({
      pullRequestId: pullRequest._id,
      mergeMethod: method,
    });
    
    toast.success("Pull request merged successfully");
    await refetchPR();
  }, [pullRequest, mergePR, refetchPR]);

  const handleViewPR = useCallback(async () => {
    if (!pullRequest) {
      await createOrUpdatePR.mutate({
        taskId: taskId as Id<"tasks">,
        isDraft: true,
      });
      await refetchPR();
    }
    
    if (pullRequest?.prUrl) {
      window.open(pullRequest.prUrl, "_blank");
    }
  }, [pullRequest, createOrUpdatePR, taskId, refetchPR]);

  const checkForUpdates = useCallback(async () => {
    setIsCheckingForUpdates(true);
    try {
      await updateDiffs.mutate({
        taskId: taskId as Id<"tasks">,
      });
      await refetchDiff();
      toast.success("Diffs updated");
    } catch (error) {
      toast.error("Failed to update diffs");
    } finally {
      setIsCheckingForUpdates(false);
    }
  }, [taskId, updateDiffs, refetchDiff]);

  useEffect(() => {
    checkForUpdates();
  }, []);

  const files = taskDiff?.files || [];
  const currentFile = files[selectedFile];

  const handleEditorDidMount = (editor: editor.IStandaloneDiffEditor) => {
    editor.updateOptions({
      renderSideBySide: true,
      readOnly: true,
      scrollBeyondLastLine: false,
      minimap: { enabled: false },
    });
  };

  return (
    <div className="flex flex-col grow min-h-0 border-l border-neutral-200 dark:border-neutral-800">
      {/* Header */}
      <div className="flex flex-col gap-3 p-4 border-b border-neutral-200 dark:border-neutral-800">
        {/* Title */}
        <div className="text-lg font-medium truncate">
          {task?.text || "Loading..."}
        </div>
        
        {/* Branch and repo info */}
        <div className="flex items-center gap-4 text-sm">
          <button
            onClick={handleCopyBranch}
            className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
          >
            <GitBranch className="h-4 w-4" />
            <span className="font-mono">{task?.branch || "main"}</span>
            <Copy className="h-3 w-3" />
          </button>
          
          {task?.projectFullName && (
            <a
              href={`https://github.com/${task.projectFullName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
            >
              <Github className="h-4 w-4" />
              <span>{task.projectFullName}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {!showPRActions && pullRequest?.status !== "merged" ? (
            <Button
              onClick={handleOpenPR}
              className="bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 text-white"
            >
              {pullRequest ? "Open PR" : "Create Draft PR"}
            </Button>
          ) : pullRequest?.status !== "merged" && (
            <MergeButton onMerge={handleMerge} />
          )}
          
          {pullRequest && (
            <Button
              variant="outline"
              onClick={handleViewPR}
              className="flex items-center gap-1.5"
            >
              View PR
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={checkForUpdates}
            disabled={isCheckingForUpdates}
            className="ml-auto"
          >
            <RefreshCw className={cn("h-4 w-4", isCheckingForUpdates && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Body with diff view */}
      <div className="flex grow min-h-0">
        {/* File list sidebar */}
        <div className="w-64 border-r border-neutral-200 dark:border-neutral-800 overflow-y-auto">
          <div className="p-2">
            <div className="text-xs text-neutral-500 dark:text-neutral-400 px-2 py-1">
              {files.length} file{files.length !== 1 ? "s" : ""} changed
              {taskDiff?.stats && (
                <span className="ml-1">
                  (+{taskDiff.stats.additions} -{taskDiff.stats.deletions})
                </span>
              )}
            </div>
            {files.map((file: any, index: number) => (
              <button
                key={file.path}
                onClick={() => setSelectedFile(index)}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                  selectedFile === index && "bg-neutral-100 dark:bg-neutral-800"
                )}
              >
                <div className="truncate font-mono text-xs">{file.path}</div>
                <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  <span className="text-green-600 dark:text-green-400">+{file.additions}</span>
                  <span className="text-red-600 dark:text-red-400">-{file.deletions}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Diff viewer */}
        <div className="grow min-w-0">
          {currentFile ? (
            <DiffEditor
              original={currentFile.oldContent}
              modified={currentFile.newContent}
              language={getLanguageFromPath(currentFile.path)}
              theme="vs-dark"
              onMount={handleEditorDidMount}
              options={{
                readOnly: true,
                renderSideBySide: true,
                scrollBeyondLastLine: false,
                minimap: { enabled: false },
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-neutral-500 dark:text-neutral-400">
              {files.length === 0 ? "No changes to display" : "Select a file to view changes"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    cpp: "cpp",
    cs: "csharp",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    scala: "scala",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    fish: "shell",
    ps1: "powershell",
    html: "html",
    css: "css",
    scss: "scss",
    sass: "sass",
    less: "less",
    json: "json",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    md: "markdown",
    sql: "sql",
    graphql: "graphql",
    dockerfile: "dockerfile",
    Dockerfile: "dockerfile",
  };
  
  return languageMap[ext || ""] || "plaintext";
}