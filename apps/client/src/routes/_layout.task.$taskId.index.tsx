import { FloatingPane } from "@/components/floating-pane";
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
} from "lucide-react";
import { useState } from "react";

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

  const task = useQuery(api.tasks.getById, {
    id: taskId as Id<"tasks">,
  });
  const taskRuns = useQuery(api.taskRuns.getByTask, {
    taskId: taskId as Id<"tasks">,
  });

  // Find the crowned run (if any)
  const crownedRun = taskRuns?.find((run) => run.isCrowned);

  const handleCopyBranch = () => {
    if (crownedRun?.newBranch) {
      clipboard.copy(crownedRun.newBranch);
    }
  };

  const handleMerge = (method: MergeMethod) => {
    // TODO: Implement merge logic
    console.log("Merging with method:", method);
    if (!prIsOpen) {
      // Open PR logic
      setPrIsOpen(true);
    } else {
      // Actual merge logic
    }
  };

  const header = (
    <div className="bg-neutral-900 text-white px-4 py-3">
      {/* Task title */}
      <h1 className="text-lg font-normal mb-1 truncate" title={task?.text}>
        {task?.text || "Loading..."}
      </h1>

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
          {crownedRun?.newBranch ? (
            <span className="font-mono text-neutral-300 group-hover:text-white">
              {crownedRun.newBranch}
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
        <button className="flex items-center gap-1.5 px-3 py-1 bg-neutral-800 text-white border border-neutral-700 rounded hover:bg-neutral-700 font-medium text-xs select-none">
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
      {/* Body - will add Monaco diff viewer here */}
      <div className="flex-1 overflow-auto bg-white dark:bg-neutral-950">
        <div className="p-4 text-neutral-500 dark:text-neutral-400">
          Git diff viewer will be implemented here
        </div>
      </div>
    </FloatingPane>
  );
}
