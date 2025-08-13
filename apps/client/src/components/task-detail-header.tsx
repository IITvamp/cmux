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
  hasAnyDiffs?: boolean;
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
  hasAnyDiffs,
  onExpandAll,
  onCollapseAll,
}: TaskDetailHeaderProps) {
  const navigate = useNavigate();
  const clipboard = useClipboard({ timeout: 2000 });
  const [prIsOpen, setPrIsOpen] = useState(false);
  const { socket } = useSocket();

  // Determine if there are any diffs to open a PR for
  const hasChanges = useMemo(() => {
    if (typeof hasAnyDiffs === "boolean") return hasAnyDiffs;
    if (
      typeof totalAdditions !== "number" ||
      typeof totalDeletions !== "number"
    ) {
      return false;
    }
    return (totalAdditions || 0) + (totalDeletions || 0) > 0;
  }, [hasAnyDiffs, totalAdditions, totalDeletions]);

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
    if (!socket || !selectedRun?._id) return;
    if (
      selectedRun.pullRequestUrl &&
      selectedRun.pullRequestUrl !== "pending"
    ) {
      window.open(selectedRun.pullRequestUrl, "_blank");
      return;
    }
    setIsCreatingPr(true);
    socket.emit(
      "github-create-draft-pr",
      { taskRunId: selectedRun._id as string },
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
    <div className="bg-neutral-900 text-white px-3.5 sticky top-0 z-20 py-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-1">
        {/* Title row */}
        <div className="flex items-center gap-2 relative min-w-0">
          <h1
            className="text-sm font-bold truncate min-w-0"
            title={taskTitle}
          >
            {taskTitle || "Loading..."}
          </h1>
          {typeof totalAdditions === "number" &&
            typeof totalDeletions === "number" && (
              <div className="flex items-center gap-2 text-[11px] ml-2 shrink-0">
                <span className="text-green-600 dark:text-green-400 font-medium select-none">
                  +{totalAdditions}
                </span>
                <span className="text-red-600 dark:text-red-400 font-medium">
                  −{totalDeletions}
                </span>
              </div>
            )}
        </div>

        {/* Centered status across both rows */}
        <div
          className={clsx(
            "col-start-2 row-start-1 row-span-2 self-center justify-self-end flex items-center gap-1 text-xs text-neutral-400 transition-opacity duration-150",
            isCheckingDiffs ? "opacity-100" : "opacity-0"
          )}
        >
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Checking for changes...</span>
        </div>

        {/* Actions on right, vertically centered across rows */}
        <div className="col-start-3 row-start-1 row-span-2 self-center flex items-center gap-2 shrink-0">
          <MergeButton
            onMerge={handleMerge}
            isOpen={prIsOpen}
            disabled={selectedRun?.status !== "completed" || !hasChanges}
          />
          {selectedRun?.pullRequestUrl &&
          selectedRun.pullRequestUrl !== "pending" ? (
            <a
              href={selectedRun.pullRequestUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1 bg-neutral-800 text-white border border-neutral-700 rounded hover:bg-neutral-700 font-medium text-xs select-none whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {selectedRun.pullRequestIsDraft ? "View draft PR" : "View PR"}
            </a>
          ) : (
            <button
              onClick={handleViewPR}
              className="flex items-center gap-1.5 px-3 py-1 bg-neutral-800 text-white border border-neutral-700 rounded hover:bg-neutral-700 font-medium text-xs select-none disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
              disabled={
                selectedRun?.status !== "completed" ||
                isCreatingPr ||
                !hasChanges
              }
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {isCreatingPr ? "Creating PR..." : "Open draft PR"}
            </button>
          )}

          <button className="flex items-center gap-1.5 px-3 py-1 bg-neutral-800 text-white border border-neutral-700 rounded hover:bg-neutral-700 font-medium text-xs select-none whitespace-nowrap">
            <Package className="w-3.5 h-3.5" />
            Open in VS Code
          </button>

          <button className="p-1 text-neutral-400 hover:text-white select-none hidden">
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 text-neutral-400 hover:text-white select-none hidden">
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
        </div>

        {/* Branch row */}
        <div className="flex items-center gap-2 text-xs text-neutral-400 min-w-0">
          <button
            onClick={handleCopyBranch}
            className="flex items-center gap-1 hover:text-white transition-colors group"
          >
            <div className="relative w-3 h-3">
              <GitBranch
                className={clsx(
                  "w-3 h-3 absolute inset-0 z-0",
                  clipboard.copied ? "hidden" : "block group-hover:hidden"
                )}
                aria-hidden={clipboard.copied}
              />
              <Copy
                className={clsx(
                  "w-3 h-3 absolute inset-0 z-10",
                  clipboard.copied ? "hidden" : "hidden group-hover:block"
                )}
                aria-hidden={clipboard.copied}
              />
              <Check
                className={clsx(
                  "w-3 h-3 text-green-400 absolute inset-0 z-20",
                  clipboard.copied ? "block" : "hidden"
                )}
                aria-hidden={!clipboard.copied}
              />
            </div>
            {selectedRun?.newBranch ? (
              <span className="font-mono text-neutral-300 group-hover:text-white text-[11px] truncate min-w-0 max-w-full">
                {selectedRun.newBranch}
              </span>
            ) : (
              <span className="font-mono text-neutral-500">No branch</span>
            )}
          </button>

          <span className="text-neutral-600">in</span>

          {task?.projectFullName && (
            <span className="font-mono text-neutral-300 truncate min-w-0 max-w-[40%]">
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
      </div>
    </div>
  );
}
