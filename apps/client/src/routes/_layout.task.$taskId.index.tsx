import { FloatingPane } from "@/components/floating-pane";
import { GitDiffViewer } from "@/components/git-diff-viewer";
import { MergeButton, type MergeMethod } from "@/components/ui/merge-button";
import { api } from "@cmux/convex/api";
import { type Id } from "@cmux/convex/dataModel";
import { convexQuery } from "@convex-dev/react-query";
import { useClipboard } from "@mantine/hooks";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
  Check,
  Copy,
  ExternalLink,
  GitBranch,
  Package,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";

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
    ]);
  },
});

function TaskDetailPage() {
  const { taskId } = Route.useParams();
  const clipboard = useClipboard({ timeout: 2000 });
  const [isHovering, setIsHovering] = useState(false);
  const [prIsOpen, setPrIsOpen] = useState(false); // Track if PR is open
  const [isCheckingDiffs, setIsCheckingDiffs] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const task = useQuery(api.tasks.getById, {
    id: taskId as Id<"tasks">,
  });
  const taskRuns = useQuery(api.taskRuns.getByTask, {
    taskId: taskId as Id<"tasks">,
  });

  // Find the crowned run (if any)
  const crownedRun = taskRuns?.find((run) => run.isCrowned);
  
  // Select the run to display (either explicitly selected, crowned, or first available)
  const selectedRun = useMemo(() => {
    if (selectedRunId) {
      return taskRuns?.find(run => run._id === selectedRunId);
    }
    // Default to crowned run if available, otherwise first completed run
    return crownedRun || taskRuns?.find(run => run.status === "completed") || taskRuns?.[0];
  }, [selectedRunId, taskRuns, crownedRun]);
  
  // Fetch diffs for the selected run
  const diffs = useQuery(
    api.gitDiffs.getByTaskRun, 
    selectedRun ? { taskRunId: selectedRun._id } : "skip"
  );

  // Check for new changes on mount and periodically
  useEffect(() => {
    if (!selectedRun) return;

    const checkForChanges = async () => {
      setIsCheckingDiffs(true);
      // TODO: Implement actual diff fetching from git
      // This would call a server endpoint that:
      // 1. Runs git diff in the worktree
      // 2. Compares with stored diffs
      // 3. Updates if different
      setTimeout(() => setIsCheckingDiffs(false), 1000);
    };

    // Check on mount
    checkForChanges();

    // Check periodically (every 30 seconds)
    const interval = setInterval(checkForChanges, 30000);

    return () => clearInterval(interval);
  }, [selectedRun?._id]);

  const handleCopyBranch = () => {
    if (selectedRun?.newBranch) {
      clipboard.copy(selectedRun.newBranch);
    }
  };

  const handleMerge = (method: MergeMethod) => {
    // TODO: Implement merge logic
    console.log("Merging with method:", method);
    if (!prIsOpen) {
      // TODO: Create PR via API
      setPrIsOpen(true);
    } else {
      // TODO: Execute merge via API
    }
  };

  const handleViewPR = () => {
    if (crownedRun?.pullRequestUrl && crownedRun.pullRequestUrl !== "pending") {
      window.open(crownedRun.pullRequestUrl, "_blank");
    } else {
      // TODO: Create draft PR if it doesn't exist
      console.log("Creating draft PR...");
    }
  };

  const header = (
    <div className="bg-neutral-900 text-white px-4 py-3">
      {/* Task title with loading indicator */}
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-normal truncate flex-1" title={task?.text}>
          {task?.text || "Loading..."}
        </h1>
        {isCheckingDiffs && (
          <div className="flex items-center gap-1 text-xs text-neutral-400">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Checking for changes...</span>
          </div>
        )}
      </div>

      {/* Branch and repo info - more compact */}
      <div className="flex items-center gap-2 text-xs text-neutral-400 mb-2">
        <button
          onClick={handleCopyBranch}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          className="flex items-center gap-1 hover:text-white transition-colors group"
        >
          <div className="relative w-3 h-3">
            <GitBranch
              className="w-3 h-3 absolute inset-0 transition-opacity duration-150"
              style={{ opacity: isHovering || clipboard.copied ? 0 : 1 }}
              aria-hidden={isHovering || clipboard.copied}
            />
            <Copy
              className="w-3 h-3 absolute inset-0 transition-opacity duration-150"
              style={{ opacity: isHovering && !clipboard.copied ? 1 : 0 }}
              aria-hidden={!isHovering || clipboard.copied}
            />
            <Check
              className="w-3 h-3 text-green-400 absolute inset-0 transition-opacity duration-150"
              style={{ opacity: clipboard.copied ? 1 : 0 }}
              aria-hidden={!clipboard.copied}
            />
          </div>
          {selectedRun?.newBranch ? (
            <span className="font-mono text-neutral-300 group-hover:text-white">
              {selectedRun.newBranch}
            </span>
          ) : (
            <span className="font-mono text-neutral-500">No branch</span>
          )}
        </button>

        <span className="text-neutral-600">in</span>

        {/* Repository */}
        {task?.projectFullName && (
          <span className="font-mono text-neutral-300">
            {task.projectFullName}
          </span>
        )}
      </div>

      {/* Action buttons - more compact */}
      <div className="flex items-center gap-2">
        {/* Merge button with dropdown */}
        <MergeButton
          onMerge={handleMerge}
          isOpen={prIsOpen}
          disabled={!crownedRun?.newBranch}
        />

        {/* View PR button */}
        <button 
          onClick={handleViewPR}
          className="flex items-center gap-1.5 px-3 py-1 bg-neutral-800 text-white border border-neutral-700 rounded hover:bg-neutral-700 font-medium text-xs select-none"
          disabled={!crownedRun?.newBranch}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          View PR
        </button>

        <button className="flex items-center gap-1.5 px-3 py-1 bg-neutral-800 text-white border border-neutral-700 rounded hover:bg-neutral-700 font-medium text-xs select-none">
          <Package className="w-3.5 h-3.5" />
          Open in VS Code
        </button>

        {/* Additional action buttons */}
        <button className="p-1 text-neutral-400 hover:text-white select-none">
          <ExternalLink className="w-3.5 h-3.5" />
        </button>

        <button className="p-1 text-neutral-400 hover:text-white select-none">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <FloatingPane header={header}>
      {/* Git diff viewer */}
      <div className="flex-1 overflow-hidden bg-white dark:bg-neutral-950">
        <GitDiffViewer 
          diffs={diffs || []} 
          isLoading={!diffs && !!crownedRun}
        />
      </div>
    </FloatingPane>
  );
}
