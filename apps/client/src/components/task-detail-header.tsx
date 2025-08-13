import { Dropdown } from "@/components/ui/dropdown";
import { MergeButton, type MergeMethod } from "@/components/ui/merge-button";
import { useSocket } from "@/contexts/socket/use-socket";
import type { Doc } from "@cmux/convex/dataModel";
import { useClipboard } from "@mantine/hooks";
import { useNavigate } from "@tanstack/react-router";
import clsx from "clsx";
import {
  Check,
  ChevronDown,
  Copy,
  Crown,
  EllipsisVertical,
  ExternalLink,
  GitBranch,
  Package,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface TaskDetailHeaderProps {
  task?: Doc<"tasks"> | null;
  taskRuns?: Doc<"taskRuns">[] | null;
  selectedRun?: Doc<"taskRuns"> | null;
  isCheckingDiffs: boolean;
  isCreatingPr: boolean;
  setIsCreatingPr: (v: boolean) => void;
  onMerge: (method: MergeMethod) => void;
  totalAdditions?: number;
  totalDeletions?: number;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
}

export function TaskDetailHeader({
  task,
  taskRuns,
  selectedRun,
  isCheckingDiffs,
  isCreatingPr,
  setIsCreatingPr,
  onMerge,
  totalAdditions,
  totalDeletions,
  onExpandAll,
  onCollapseAll,
}: TaskDetailHeaderProps) {
  const navigate = useNavigate();
  const clipboard = useClipboard({ timeout: 2000 });
  const [isHovering, setIsHovering] = useState(false);
  const [prIsOpen, setPrIsOpen] = useState(false);
  const { socket } = useSocket();

  const crownedRun = useMemo(
    () => taskRuns?.find((r) => r.isCrowned) ?? null,
    [taskRuns]
  );

  const taskTitle = task?.pullRequestTitle || task?.text;

  const handleCopyBranch = () => {
    if (selectedRun?.newBranch) {
      clipboard.copy(selectedRun.newBranch);
    }
  };

  const handleMerge = (method: MergeMethod) => {
    onMerge(method);
    if (!prIsOpen) {
      setPrIsOpen(true);
    }
  };

  const handleViewPR = () => {
    if (!socket || !crownedRun?._id) return;
    if (crownedRun.pullRequestUrl && crownedRun.pullRequestUrl !== "pending") {
      window.open(crownedRun.pullRequestUrl, "_blank");
      return;
    }
    setIsCreatingPr(true);
    socket.emit(
      "github-create-draft-pr",
      { taskRunId: crownedRun._id as string },
      (resp: { success: boolean; url?: string; error?: string }) => {
        setIsCreatingPr(false);
        if (resp.success && resp.url) {
          window.open(resp.url, "_blank");
        } else if (resp.error) {
          console.error("Failed to create draft PR:", resp.error);
          toast.error("Failed to create draft PR", {
            description: resp.error,
          });
        }
      }
    );
  };

  return (
    <div className="bg-neutral-900 text-white px-4 sticky top-0 z-10 pb-1.5">
      <div className="flex items-center gap-2">
        <h1
          className="text-lg font-normal truncate flex-1 min-w-0 overflow-ellipsis"
          title={taskTitle}
        >
          {taskTitle || "Loading..."}
        </h1>
        <div
          className={clsx(
            "flex items-center gap-1 text-xs text-neutral-400 absolute right-2 transition-opacity duration-150 bg-neutral-900 px-2 py-1 rounded-md",
            isCheckingDiffs ? "opacity-100" : "opacity-0"
          )}
        >
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Checking for changes...</span>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
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

        {task?.projectFullName && (
          <span className="font-mono text-neutral-300">
            {task.projectFullName}
          </span>
        )}

        {taskRuns && taskRuns.length > 0 && (
          <>
            <span className="text-neutral-600">by</span>
            <Dropdown.Root>
              <Dropdown.Trigger className="flex items-center gap-1 text-neutral-300 hover:text-white transition-colors text-xs">
                <span>{selectedRun?.agentName || "Unknown agent"}</span>
                <ChevronDown className="w-3 h-3" />
              </Dropdown.Trigger>

              <Dropdown.Portal>
                <Dropdown.Positioner sideOffset={5}>
                  <Dropdown.Arrow />
                  <Dropdown.Popup className="min-w-[200px]">
                    {taskRuns.map((run) => {
                      const agentName =
                        run.agentName ||
                        run.prompt?.match(/\(([^)]+)\)$/)?.[1] ||
                        "Unknown agent";
                      const isSelected = run._id === selectedRun?._id;
                      return (
                        <Dropdown.CheckboxItem
                          key={run._id}
                          checked={isSelected}
                          onCheckedChange={() => {
                            if (!isSelected) {
                              navigate({
                                to: "/task/$taskId",
                                params: { taskId: task?._id as string },
                                search: { runId: run._id },
                              });
                            }
                          }}
                        >
                          <Dropdown.CheckboxItemIndicator>
                            <Check className="w-3 h-3" />
                          </Dropdown.CheckboxItemIndicator>
                          <span className="col-start-2 flex items-center gap-1.5">
                            {agentName}
                            {run.isCrowned && (
                              <Crown className="w-3 h-3 text-yellow-500 absolute right-4" />
                            )}
                          </span>
                        </Dropdown.CheckboxItem>
                      );
                    })}
                  </Dropdown.Popup>
                </Dropdown.Positioner>
              </Dropdown.Portal>
            </Dropdown.Root>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <MergeButton
          onMerge={handleMerge}
          isOpen={prIsOpen}
          disabled={!crownedRun?.newBranch}
        />
        {crownedRun?.pullRequestUrl &&
        crownedRun.pullRequestUrl !== "pending" ? (
          <a
            href={crownedRun.pullRequestUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1 bg-neutral-800 text-white border border-neutral-700 rounded hover:bg-neutral-700 font-medium text-xs select-none"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {crownedRun.pullRequestIsDraft ? "View draft PR" : "View PR"}
          </a>
        ) : (
          <button
            onClick={handleViewPR}
            className="flex items-center gap-1.5 px-3 py-1 bg-neutral-800 text-white border border-neutral-700 rounded hover:bg-neutral-700 font-medium text-xs select-none disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={!crownedRun?.newBranch || isCreatingPr}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {isCreatingPr ? "Creating PR..." : "Open draft PR"}
          </button>
        )}

        <button className="flex items-center gap-1.5 px-3 py-1 bg-neutral-800 text-white border border-neutral-700 rounded hover:bg-neutral-700 font-medium text-xs select-none">
          <Package className="w-3.5 h-3.5" />
          Open in VS Code
        </button>

        <button className="p-1 text-neutral-400 hover:text-white select-none">
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
        <button className="p-1 text-neutral-400 hover:text-white select-none">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <Dropdown.Root>
          <Dropdown.Trigger
            className="p-1 text-neutral-400 hover:text-white select-none"
            aria-label="More actions"
          >
            <EllipsisVertical className="w-3.5 h-3.5" />
          </Dropdown.Trigger>
          <Dropdown.Portal>
            <Dropdown.Positioner sideOffset={5}>
              <Dropdown.Popup>
                <Dropdown.Arrow />
                <Dropdown.Item onClick={() => onExpandAll?.()}>
                  Expand all
                </Dropdown.Item>
                <Dropdown.Item onClick={() => onCollapseAll?.()}>
                  Collapse all
                </Dropdown.Item>
              </Dropdown.Popup>
            </Dropdown.Positioner>
          </Dropdown.Portal>
        </Dropdown.Root>
        {typeof totalAdditions === "number" &&
          typeof totalDeletions === "number" && (
            <div className="flex items-center gap-2 text-[11px] ml-1">
              <span className="text-green-600 dark:text-green-400 font-medium select-none">
                +{totalAdditions}
              </span>
              <span className="text-red-600 dark:text-red-400 font-medium">
                −{totalDeletions}
              </span>
            </div>
          )}
      </div>
    </div>
  );
}
