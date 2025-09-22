import { Dropdown } from "@/components/ui/dropdown";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useArchiveTask } from "@/hooks/useArchiveTask";
import { useOpenWithActions } from "@/hooks/useOpenWithActions";
import { isElectron } from "@/lib/electron";
import { ContextMenu } from "@base-ui-components/react/context-menu";
import { type Doc, type Id } from "@cmux/convex/dataModel";
import { Link, useLocation } from "@tanstack/react-router";
import clsx from "clsx";
import {
  Archive as ArchiveIcon,
  ArchiveRestore as ArchiveRestoreIcon,
  CheckCircle,
  Circle,
  Copy as CopyIcon,
  Crown,
  EllipsisVertical,
  ExternalLink,
  GitBranch,
  GitCompare,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  Globe,
  Loader2,
  XCircle,
} from "lucide-react";
import {
  Fragment,
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { SidebarListItem } from "./sidebar/SidebarListItem";

interface TaskRunWithChildren extends Doc<"taskRuns"> {
  children: TaskRunWithChildren[];
}

type PreviewService = NonNullable<TaskRunWithChildren["networking"]>[number];

export interface TaskWithRuns extends Doc<"tasks"> {
  runs: TaskRunWithChildren[];
}

function sanitizeBranchName(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const idx = trimmed.lastIndexOf("-");
  if (idx <= 0) return trimmed;
  const candidate = trimmed.slice(0, idx);
  return candidate || trimmed;
}

function inferTaskBranch(task: TaskWithRuns): string | null {
  const fromTask = sanitizeBranchName(task.baseBranch);
  if (fromTask) return fromTask;

  const queue: TaskRunWithChildren[] = [...task.runs];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const sanitized = sanitizeBranchName(current.newBranch);
    if (sanitized) {
      return sanitized;
    }
    if (current.children.length > 0) {
      queue.push(...current.children);
    }
  }

  return null;
}

interface TaskTreeProps {
  task: TaskWithRuns;
  level?: number;
  // When true, expand the task node on initial mount
  defaultExpanded?: boolean;
  teamSlugOrId: string;
}

// Extract the display text logic to avoid re-creating it on every render
function getRunDisplayText(run: TaskRunWithChildren): string {
  const fromRun = run.agentName?.trim();
  if (fromRun && fromRun.length > 0) {
    return fromRun;
  }

  if (run.summary) {
    return run.summary;
  }

  return run.prompt.substring(0, 50) + "...";
}

// Build a map of runId -> decorated agent name with (1), (2), ... suffixes
// for sibling groups that contain duplicates of the same agent.
function buildDecoratedAgentNameMap(
  runs: TaskRunWithChildren[]
): Map<Id<"taskRuns">, string> {
  const map = new Map<Id<"taskRuns">, string>();

  const visitSiblings = (siblings: TaskRunWithChildren[]): void => {
    // Compute total counts per agent name for this sibling group
    const totals = new Map<string, number>();
    for (const r of siblings) {
      const name = r.agentName?.trim();
      if (!name) continue;
      totals.set(name, (totals.get(name) ?? 0) + 1);
    }
    // Now, assign indices for any agent name that appears more than once
    const seen = new Map<string, number>();
    for (const r of siblings) {
      const name = r.agentName?.trim();
      if (name) {
        const total = totals.get(name) ?? 0;
        if (total > 1) {
          const current = (seen.get(name) ?? 0) + 1;
          seen.set(name, current);
          map.set(r._id, `${name} (${current})`);
        }
      }
      if (r.children && r.children.length > 0) {
        visitSiblings(r.children);
      }
    }
  };

  visitSiblings(runs);
  return map;
}

type TaskRunExpansionState = Partial<Record<Id<"taskRuns">, boolean>>;

interface TaskRunExpansionContextValue {
  expandedRuns: TaskRunExpansionState;
  setRunExpanded: (runId: Id<"taskRuns">, expanded: boolean) => void;
}

const TaskRunExpansionContext =
  createContext<TaskRunExpansionContextValue | null>(null);

function useTaskRunExpansionContext(): TaskRunExpansionContextValue {
  const context = useContext(TaskRunExpansionContext);

  if (!context) {
    throw new Error(
      "useTaskRunExpansionContext must be used within TaskRunExpansionContext"
    );
  }

  return context;
}

function TaskTreeInner({
  task,
  level = 0,
  defaultExpanded = false,
  teamSlugOrId,
}: TaskTreeProps) {
  // Get the current route to determine if this task is selected
  const location = useLocation();
  const isTaskSelected = useMemo(
    () => location.pathname.includes(`/task/${task._id}`),
    [location.pathname, task._id]
  );

  const [expandedRuns, setExpandedRuns] = useState<TaskRunExpansionState>({});
  const setRunExpanded = useCallback(
    (runId: Id<"taskRuns">, expanded: boolean) => {
      setExpandedRuns((prev) => {
        if (prev[runId] === expanded) {
          return prev;
        }

        return { ...prev, [runId]: expanded };
      });
    },
    [setExpandedRuns]
  );

  const expansionContextValue = useMemo(
    () => ({ expandedRuns, setRunExpanded }),
    [expandedRuns, setRunExpanded]
  );

  // Default to collapsed unless this task is selected or flagged to expand
  const [isExpanded, setIsExpanded] = useState<boolean>(
    isTaskSelected || defaultExpanded
  );
  const hasRuns = task.runs && task.runs.length > 0;

  // Memoize the toggle handler
  const handleToggle = useCallback(
    (_event?: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
      setIsExpanded((prev) => !prev);
    },
    []
  );

  const { archiveWithUndo, unarchive } = useArchiveTask(teamSlugOrId);

  const handleCopyDescription = useCallback(() => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(task.text).catch(() => {});
    }
  }, [task.text]);

  const handleArchive = useCallback(() => {
    archiveWithUndo(task);
  }, [archiveWithUndo, task]);

  const handleUnarchive = useCallback(() => {
    unarchive(task._id);
  }, [unarchive, task._id]);

  const inferredBranch = inferTaskBranch(task);
  const taskSecondaryParts: string[] = [];
  if (inferredBranch) {
    taskSecondaryParts.push(inferredBranch);
  }
  if (task.projectFullName) {
    taskSecondaryParts.push(task.projectFullName);
  }
  const taskSecondary = taskSecondaryParts.join(" • ");

  const canExpand = hasRuns;

  // Precompute decorated agent names with indices for the entire tree
  const decoratedAgentNames = useMemo(
    () => buildDecoratedAgentNameMap(task.runs),
    [task.runs]
  );

  const taskLeadingIcon = (() => {
    if (task.mergeStatus && task.mergeStatus !== "none") {
      switch (task.mergeStatus) {
        case "pr_draft":
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <GitPullRequestDraft className="w-3 h-3 text-neutral-500" />
              </TooltipTrigger>
              <TooltipContent side="right">Draft PR</TooltipContent>
            </Tooltip>
          );
        case "pr_open":
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <GitPullRequest className="w-3 h-3 text-[#1f883d] dark:text-[#238636]" />
              </TooltipTrigger>
              <TooltipContent side="right">PR Open</TooltipContent>
            </Tooltip>
          );
        case "pr_approved":
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <GitPullRequest className="w-3 h-3 text-[#1f883d] dark:text-[#238636]" />
              </TooltipTrigger>
              <TooltipContent side="right">PR Approved</TooltipContent>
            </Tooltip>
          );
        case "pr_changes_requested":
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <GitPullRequest className="w-3 h-3 text-yellow-500" />
              </TooltipTrigger>
              <TooltipContent side="right">Changes Requested</TooltipContent>
            </Tooltip>
          );
        case "pr_merged":
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <GitMerge className="w-3 h-3 text-purple-500" />
              </TooltipTrigger>
              <TooltipContent side="right">Merged</TooltipContent>
            </Tooltip>
          );
        case "pr_closed":
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <GitPullRequestClosed className="w-3 h-3 text-red-500" />
              </TooltipTrigger>
              <TooltipContent side="right">PR Closed</TooltipContent>
            </Tooltip>
          );
        default:
          return null;
      }
    }

    return task.isCompleted ? (
      <CheckCircle className="w-3 h-3 text-green-500" />
    ) : (
      <Circle className="w-3 h-3 text-neutral-400 animate-pulse" />
    );
  })();

  return (
    <TaskRunExpansionContext.Provider value={expansionContextValue}>
      <div className="select-none flex flex-col">
        <ContextMenu.Root>
          <ContextMenu.Trigger>
            <Link
              to="/$teamSlugOrId/task/$taskId"
              params={{ teamSlugOrId, taskId: task._id }}
              search={{ runId: undefined }}
              activeOptions={{ exact: true }}
              className="group block"
              onClick={(event) => {
                if (
                  !canExpand ||
                  event.defaultPrevented ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                ) {
                  return;
                }
                handleToggle(event);
              }}
            >
              <SidebarListItem
                paddingLeft={10 + level * 4}
                toggle={{
                  expanded: isExpanded,
                  onToggle: handleToggle,
                  visible: canExpand,
                }}
                title={task.pullRequestTitle || task.text}
                titleClassName="text-[13px] text-neutral-900 dark:text-neutral-100"
                secondary={taskSecondary || undefined}
                meta={taskLeadingIcon || undefined}
              />
            </Link>
          </ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner className="outline-none z-[var(--z-context-menu)]">
              <ContextMenu.Popup className="origin-[var(--transform-origin)] rounded-md bg-white dark:bg-neutral-800 py-1 text-neutral-900 dark:text-neutral-100 shadow-lg shadow-gray-200 outline-1 outline-neutral-200 transition-[opacity] data-[ending-style]:opacity-0 dark:shadow-none dark:-outline-offset-1 dark:outline-neutral-700">
                <ContextMenu.Item
                  className="flex items-center gap-2 cursor-default py-1.5 pr-8 pl-3 text-[13px] leading-5 outline-none select-none data-[highlighted]:relative data-[highlighted]:z-0 data-[highlighted]:text-white data-[highlighted]:before:absolute data-[highlighted]:before:inset-x-1 data-[highlighted]:before:inset-y-0 data-[highlighted]:before:z-[-1] data-[highlighted]:before:rounded-sm data-[highlighted]:before:bg-neutral-900 dark:data-[highlighted]:before:bg-neutral-700"
                  onClick={handleCopyDescription}
                >
                  <CopyIcon className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />
                  <span>Copy Description</span>
                </ContextMenu.Item>
                {task.isArchived ? (
                  <ContextMenu.Item
                    className="flex items-center gap-2 cursor-default py-1.5 pr-8 pl-3 text-[13px] leading-5 outline-none select-none data-[highlighted]:relative data-[highlighted]:z-0 data-[highlighted]:text-white data-[highlighted]:before:absolute data-[highlighted]:before:inset-x-1 data-[highlighted]:before:inset-y-0 data-[highlighted]:before:z-[-1] data-[highlighted]:before:rounded-sm data-[highlighted]:before:bg-neutral-900 dark:data-[highlighted]:before:bg-neutral-700"
                    onClick={handleUnarchive}
                  >
                    <ArchiveRestoreIcon className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />
                    <span>Unarchive Task</span>
                  </ContextMenu.Item>
                ) : (
                  <ContextMenu.Item
                    className="flex items-center gap-2 cursor-default py-1.5 pr-8 pl-3 text-[13px] leading-5 outline-none select-none data-[highlighted]:relative data-[highlighted]:z-0 data-[highlighted]:text-white data-[highlighted]:before:absolute data-[highlighted]:before:inset-x-1 data-[highlighted]:before:inset-y-0 data-[highlighted]:before:z-[-1] data-[highlighted]:before:rounded-sm data-[highlighted]:before:bg-neutral-900 dark:data-[highlighted]:before:bg-neutral-700"
                    onClick={handleArchive}
                  >
                    <ArchiveIcon className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />
                    <span>Archive Task</span>
                  </ContextMenu.Item>
                )}
              </ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>

        {isExpanded && hasRuns && (
          <div className="flex flex-col">
            {task.runs.map((run) => (
              <TaskRunTree
                key={run._id}
                run={run}
                level={level + 1}
                taskId={task._id}
                teamSlugOrId={teamSlugOrId}
                decoratedAgentNames={decoratedAgentNames}
              />
            ))}
          </div>
        )}
      </div>
    </TaskRunExpansionContext.Provider>
  );
}

interface TaskRunTreeProps {
  run: TaskRunWithChildren;
  level: number;
  taskId: Id<"tasks">;
  teamSlugOrId: string;
  decoratedAgentNames: Map<Id<"taskRuns">, string>;
}

function TaskRunTreeInner({
  run,
  level,
  taskId,
  teamSlugOrId,
  decoratedAgentNames,
}: TaskRunTreeProps) {
  const { expandedRuns, setRunExpanded } = useTaskRunExpansionContext();
  const defaultExpanded = Boolean(run.isCrowned);
  const isExpanded = expandedRuns[run._id] ?? defaultExpanded;
  const hasChildren = run.children.length > 0;

  // Memoize the display text; prefer decorated agent name if present
  const displayText = useMemo(() => {
    const decorated = decoratedAgentNames.get(run._id);
    if (decorated) return decorated;
    return getRunDisplayText(run);
  }, [decoratedAgentNames, run]);

  // Memoize the toggle handler
  const handleToggle = useCallback(
    (_event?: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
      setRunExpanded(run._id, !isExpanded);
    },
    [isExpanded, run._id, setRunExpanded]
  );

  const statusIcon = {
    pending: <Circle className="w-3 h-3 text-neutral-400" />,
    running: <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />,
    completed: <CheckCircle className="w-3 h-3 text-green-500" />,
    failed: <XCircle className="w-3 h-3 text-red-500" />,
  }[run.status];

  const runLeadingIcon =
    run.status === "failed" && run.errorMessage ? (
      <Tooltip>
        <TooltipTrigger asChild>{statusIcon}</TooltipTrigger>
        <TooltipContent
          side="right"
          className="max-w-xs whitespace-pre-wrap break-words"
        >
          {run.errorMessage}
        </TooltipContent>
      </Tooltip>
    ) : (
      statusIcon
    );

  const crownIcon = run.isCrowned ? (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Crown className="w-3 h-3 text-yellow-500" />
      </TooltipTrigger>
      {run.crownReason ? (
        <TooltipContent
          side="right"
          sideOffset={6}
          className="max-w-sm p-3 z-[var(--z-overlay)]"
        >
          <div className="space-y-1.5">
            <p className="font-medium text-sm">Evaluation Reason</p>
            <p className="text-xs text-muted-foreground">{run.crownReason}</p>
          </div>
        </TooltipContent>
      ) : null}
    </Tooltip>
  ) : null;

  const leadingContent = crownIcon ? (
    <div className="flex items-center gap-1">
      {crownIcon}
      {runLeadingIcon}
    </div>
  ) : (
    runLeadingIcon
  );

  // Generate VSCode URL if available
  const hasActiveVSCode = run.vscode?.status === "running";
  const vscodeUrl = useMemo(
    () => (hasActiveVSCode && run.vscode?.url) || null,
    [hasActiveVSCode, run]
  );

  // Collect running preview ports
  const previewServices = useMemo(() => {
    if (!run.networking) return [];
    return run.networking.filter((service) => service.status === "running");
  }, [run.networking]);

  const {
    actions: openWithActions,
    executeOpenAction,
    copyBranch: copyRunBranch,
    ports: portActions,
    executePortAction,
  } = useOpenWithActions({
    vscodeUrl,
    worktreePath: run.worktreePath,
    branch: run.newBranch,
    networking: run.networking,
  });

  const shouldRenderDiffLink = true;
  const shouldRenderPullRequestLink = Boolean(
    run.pullRequestUrl && run.pullRequestUrl !== "pending"
  );
  const shouldRenderPreviewLink = previewServices.length > 0;
  const hasCollapsibleContent =
    hasChildren ||
    hasActiveVSCode ||
    shouldRenderDiffLink ||
    shouldRenderPullRequestLink ||
    shouldRenderPreviewLink;

  return (
    <Fragment>
      <ContextMenu.Root>
        <ContextMenu.Trigger>
          <div
            onClick={() => {
              if (!hasCollapsibleContent) {
                return;
              }
              handleToggle();
            }}
          >
            <SidebarListItem
              containerClassName="mt-px"
              paddingLeft={10 + level * 16}
              toggle={{
                expanded: isExpanded,
                onToggle: handleToggle,
                visible: hasCollapsibleContent,
              }}
              title={displayText}
              titleClassName="text-[13px] text-neutral-700 dark:text-neutral-300"
              meta={leadingContent}
            />
          </div>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner className="outline-none z-[var(--z-context-menu)]">
            <ContextMenu.Popup className="origin-[var(--transform-origin)] rounded-md bg-white dark:bg-neutral-800 py-1 text-neutral-900 dark:text-neutral-100 shadow-lg shadow-gray-200 outline-1 outline-neutral-200 transition-[opacity] data-[ending-style]:opacity-0 dark:shadow-none dark:-outline-offset-1 dark:outline-neutral-700">
              {openWithActions.length > 0 ? (
                <>
                  <div className="px-3 py-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400 select-none">
                    Open with
                  </div>
                  {openWithActions.map((action) => {
                    const Icon = action.Icon;
                    return (
                      <ContextMenu.Item
                        key={action.id}
                        className="flex items-center gap-2 cursor-default py-1.5 pr-8 pl-3 text-[13px] leading-5 outline-none select-none data-[highlighted]:relative data-[highlighted]:z-0 data-[highlighted]:text-white data-[highlighted]:before:absolute data-[highlighted]:before:inset-x-1 data-[highlighted]:before:inset-y-0 data-[highlighted]:before:z-[-1] data-[highlighted]:before:rounded-sm data-[highlighted]:before:bg-neutral-900 dark:data-[highlighted]:before:bg-neutral-700"
                        onClick={() => executeOpenAction(action)}
                      >
                        {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
                        {action.name}
                      </ContextMenu.Item>
                    );
                  })}
                  {(copyRunBranch || portActions.length > 0) && (
                    <div className="my-1 h-px bg-neutral-200 dark:bg-neutral-700" />
                  )}
                </>
              ) : null}
              {copyRunBranch ? (
                <>
                  <ContextMenu.Item
                    className="flex items-center gap-2 cursor-default py-1.5 pr-8 pl-3 text-[13px] leading-5 outline-none select-none data-[highlighted]:relative data-[highlighted]:z-0 data-[highlighted]:text-white data-[highlighted]:before:absolute data-[highlighted]:before:inset-x-1 data-[highlighted]:before:inset-y-0 data-[highlighted]:before:z-[-1] data-[highlighted]:before:rounded-sm data-[highlighted]:before:bg-neutral-900 dark:data-[highlighted]:before:bg-neutral-700"
                    onClick={copyRunBranch}
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    Copy branch name
                  </ContextMenu.Item>
                  {portActions.length > 0 && (
                    <div className="my-1 h-px bg-neutral-200 dark:bg-neutral-700" />
                  )}
                </>
              ) : null}
              {portActions.length > 0 ? (
                <>
                  <div className="px-3 py-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400 select-none">
                    Forwarded ports
                  </div>
                  {portActions.map((port) => (
                    <ContextMenu.Item
                      key={port.port}
                      className="flex items-center gap-2 cursor-default py-1.5 pr-8 pl-3 text-[13px] leading-5 outline-none select-none data-[highlighted]:relative data-[highlighted]:z-0 data-[highlighted]:text-white data-[highlighted]:before:absolute data-[highlighted]:before:inset-x-1 data-[highlighted]:before:inset-y-0 data-[highlighted]:before:z-[-1] data-[highlighted]:before:rounded-sm data-[highlighted]:before:bg-neutral-900 dark:data-[highlighted]:before:bg-neutral-700"
                      onClick={() => executePortAction(port)}
                    >
                      <Globe className="w-3 h-3" />
                      Port {port.port}
                    </ContextMenu.Item>
                  ))}
                  <div className="my-1 h-px bg-neutral-200 dark:bg-neutral-700" />
                </>
              ) : null}
              <ContextMenu.Item
                className="flex items-center gap-2 cursor-default py-1.5 pr-8 pl-3 text-[13px] leading-5 outline-none select-none data-[highlighted]:relative data-[highlighted]:z-0 data-[highlighted]:text-white data-[highlighted]:before:absolute data-[highlighted]:before:inset-x-1 data-[highlighted]:before:inset-y-0 data-[highlighted]:before:z-[-1] data-[highlighted]:before:rounded-sm data-[highlighted]:before:bg-neutral-900 dark:data-[highlighted]:before:bg-neutral-700"
                onClick={() => setRunExpanded(run._id, !isExpanded)}
              >
                {isExpanded ? "Collapse details" : "Expand details"}
              </ContextMenu.Item>
            </ContextMenu.Popup>
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      <TaskRunDetails
        run={run}
        level={level}
        taskId={taskId}
        teamSlugOrId={teamSlugOrId}
        isExpanded={isExpanded}
        hasActiveVSCode={hasActiveVSCode}
        hasChildren={hasChildren}
        shouldRenderPullRequestLink={shouldRenderPullRequestLink}
        previewServices={previewServices}
      />
    </Fragment>
  );
}

interface TaskRunDetailLinkProps {
  to: string;
  params: Record<string, unknown>;
  icon: ReactNode;
  label: string;
  indentLevel: number;
  className?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

function TaskRunDetailLink({
  to,
  params,
  icon,
  label,
  indentLevel,
  className,
  onClick,
}: TaskRunDetailLinkProps) {
  return (
    <Link
      to={to}
      params={params}
      activeOptions={{ exact: true }}
      className={clsx(
        "flex items-center px-2 py-1 text-xs rounded-md hover:bg-neutral-200/45 dark:hover:bg-neutral-800/45 cursor-default mt-px",
        "[&.active]:bg-neutral-200/75 dark:[&.active]:bg-neutral-800/65",
        "[&.active]:hover:bg-neutral-200/75 dark:[&.active]:hover:bg-neutral-800/65",
        className
      )}
      style={{ paddingLeft: `${24 + indentLevel * 8}px` }}
      onClick={onClick}
    >
      {icon}
      <span className="text-neutral-600 dark:text-neutral-400">{label}</span>
    </Link>
  );
}

interface TaskRunDetailsProps {
  run: TaskRunWithChildren;
  level: number;
  taskId: Id<"tasks">;
  teamSlugOrId: string;
  isExpanded: boolean;
  hasActiveVSCode: boolean;
  hasChildren: boolean;
  shouldRenderPullRequestLink: boolean;
  previewServices: PreviewService[];
}

function TaskRunDetails({
  run,
  level,
  taskId,
  teamSlugOrId,
  isExpanded,
  hasActiveVSCode,
  hasChildren,
  shouldRenderPullRequestLink,
  previewServices,
}: TaskRunDetailsProps) {
  if (!isExpanded) {
    return null;
  }

  const indentLevel = level + 1;

  return (
    <Fragment>
      {hasActiveVSCode && (
        <TaskRunDetailLink
          to="/$teamSlugOrId/task/$taskId/run/$runId/vscode"
          params={{ teamSlugOrId, taskId, runId: run._id }}
          icon={
            <VSCodeIcon className="w-3 h-3 mr-2 text-neutral-400 grayscale opacity-60" />
          }
          label="VS Code"
          indentLevel={indentLevel}
        />
      )}

      <TaskRunDetailLink
        to="/$teamSlugOrId/task/$taskId/run/$runId/diff"
        params={{ teamSlugOrId, taskId, runId: run._id }}
        icon={<GitCompare className="w-3 h-3 mr-2 text-neutral-400" />}
        label="Git diff"
        indentLevel={indentLevel}
      />

      {shouldRenderPullRequestLink ? (
        <TaskRunDetailLink
          to="/$teamSlugOrId/task/$taskId/run/$runId/pr"
          params={{ teamSlugOrId, taskId, runId: run._id }}
          icon={<GitPullRequest className="w-3 h-3 mr-2 text-neutral-400" />}
          label="Pull Request"
          indentLevel={indentLevel}
        />
      ) : null}

      {previewServices.map((service) => (
        <div key={service.port} className="relative group mt-px">
          <TaskRunDetailLink
            to="/$teamSlugOrId/task/$taskId/run/$runId/preview/$port"
            params={{
              teamSlugOrId,
              taskId,
              runId: run._id,
              port: `${service.port}`,
            }}
            icon={<ExternalLink className="w-3 h-3 mr-2 text-neutral-400" />}
            label={`Preview (port ${service.port})`}
            indentLevel={indentLevel}
            className="pr-10"
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey) {
                event.preventDefault();
                window.open(service.url, "_blank", "noopener,noreferrer");
              }
            }}
          />

          <Dropdown.Root>
            <Dropdown.Trigger
              onClick={(event) => event.stopPropagation()}
              className={clsx(
                "absolute right-2 top-1/2 -translate-y-1/2",
                "p-1 rounded flex items-center gap-1",
                "bg-neutral-100/80 dark:bg-neutral-700/80",
                "hover:bg-neutral-200/80 dark:hover:bg-neutral-600/80",
                "text-neutral-600 dark:text-neutral-400"
              )}
            >
              <EllipsisVertical className="w-2.5 h-2.5" />
            </Dropdown.Trigger>
            <Dropdown.Portal>
              <Dropdown.Positioner
                sideOffset={8}
                side={isElectron ? "left" : "bottom"}
              >
                <Dropdown.Popup>
                  <Dropdown.Arrow />
                  <Dropdown.Item
                    onClick={() => {
                      window.open(service.url, "_blank", "noopener,noreferrer");
                    }}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open in new tab
                  </Dropdown.Item>
                </Dropdown.Popup>
              </Dropdown.Positioner>
            </Dropdown.Portal>
          </Dropdown.Root>
        </div>
      ))}

      {hasChildren ? (
        <div className="flex flex-col">
          {run.children.map((childRun) => (
            <TaskRunTree
              key={childRun._id}
              run={childRun}
              level={level + 1}
              taskId={taskId}
              teamSlugOrId={teamSlugOrId}
              decoratedAgentNames={decoratedAgentNames}
            />
          ))}
        </div>
      ) : null}
    </Fragment>
  );
}

interface VSCodeIconProps {
  className?: string;
}

function VSCodeIcon({ className }: VSCodeIconProps) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none">
      <mask
        id="mask0"
        mask-type="alpha"
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="100"
        height="100"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M70.9119 99.3171C72.4869 99.9307 74.2828 99.8914 75.8725 99.1264L96.4608 89.2197C98.6242 88.1787 100 85.9892 100 83.5872V16.4133C100 14.0113 98.6243 11.8218 96.4609 10.7808L75.8725 0.873756C73.7862 -0.130129 71.3446 0.11576 69.5135 1.44695C69.252 1.63711 69.0028 1.84943 68.769 2.08341L29.3551 38.0415L12.1872 25.0096C10.589 23.7965 8.35363 23.8959 6.86933 25.2461L1.36303 30.2549C-0.452552 31.9064 -0.454633 34.7627 1.35853 36.417L16.2471 50.0001L1.35853 63.5832C-0.454633 65.2374 -0.452552 68.0938 1.36303 69.7453L6.86933 74.7541C8.35363 76.1043 10.589 76.2037 12.1872 74.9905L29.3551 61.9587L68.769 97.9167C69.3925 98.5406 70.1246 99.0104 70.9119 99.3171ZM75.0152 27.2989L45.1091 50.0001L75.0152 72.7012V27.2989Z"
          fill="currentColor"
        />
      </mask>
      <g mask="url(#mask0)">
        <path
          d="M96.4614 10.7962L75.8569 0.875542C73.4719 -0.272773 70.6217 0.211611 68.75 2.08333L1.29858 63.5832C-0.515693 65.2373 -0.513607 68.0937 1.30308 69.7452L6.81272 74.754C8.29793 76.1042 10.5347 76.2036 12.1338 74.9905L93.3609 13.3699C96.086 11.3026 100 13.2462 100 16.6667V16.4433C100 14.0412 98.6246 11.8214 96.4614 10.7962Z"
          fill="#0065A9"
        />
        <g filter="url(#filter0_d)">
          <path
            d="M96.4614 89.2038L75.8569 99.1245C73.4719 100.273 70.6217 99.7884 68.75 97.9167L1.29858 36.4169C-0.515693 34.7627 -0.513607 31.9063 1.30308 30.2548L6.81272 25.246C8.29793 23.8958 10.5347 23.7964 12.1338 25.0095L93.3609 86.6301C96.086 88.6974 100 86.7538 100 83.3334V83.5567C100 85.9588 98.6246 88.1786 96.4614 89.2038Z"
            fill="#007ACC"
          />
        </g>
        <g filter="url(#filter1_d)">
          <path
            d="M75.8578 99.1263C73.4721 100.274 70.6219 99.7885 68.75 97.9166C71.0564 100.223 75 98.5895 75 95.3278V4.67213C75 1.41039 71.0564 -0.223106 68.75 2.08329C70.6219 0.211402 73.4721 -0.273666 75.8578 0.873633L96.4587 10.7807C98.6234 11.8217 100 14.0112 100 16.4132V83.5871C100 85.9891 98.6234 88.1786 96.4586 89.2196L75.8578 99.1263Z"
            fill="#1F9CF0"
          />
        </g>
        <g style={{ mixBlendMode: "overlay" }} opacity="0.25">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M70.8511 99.3171C72.4261 99.9306 74.2221 99.8913 75.8117 99.1264L96.4 89.2197C98.5634 88.1787 99.9392 85.9892 99.9392 83.5871V16.4133C99.9392 14.0112 98.5635 11.8217 96.4001 10.7807L75.8117 0.873695C73.7255 -0.13019 71.2838 0.115699 69.4527 1.44688C69.1912 1.63705 68.942 1.84937 68.7082 2.08335L29.2943 38.0414L12.1264 25.0096C10.5283 23.7964 8.29285 23.8959 6.80855 25.246L1.30225 30.2548C-0.513334 31.9064 -0.515415 34.7627 1.29775 36.4169L16.1863 50L1.29775 63.5832C-0.515415 65.2374 -0.513334 68.0937 1.30225 69.7452L6.80855 74.754C8.29285 76.1042 10.5283 76.2036 12.1264 74.9905L29.2943 61.9586L68.7082 97.9167C69.3317 98.5405 70.0638 99.0104 70.8511 99.3171ZM74.9544 27.2989L45.0483 50L74.9544 72.7012V27.2989Z"
            fill="url(#paint0_linear)"
          />
        </g>
      </g>
      <defs>
        <filter
          id="filter0_d"
          x="-8.39411"
          y="15.8291"
          width="116.727"
          height="92.2456"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          />
          <feOffset />
          <feGaussianBlur stdDeviation="4.16667" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"
          />
          <feBlend
            mode="normal"
            in2="BackgroundImageFix"
            result="effect1_dropShadow"
          />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow"
            result="shape"
          />
        </filter>
        <filter
          id="filter1_d"
          x="66.6666"
          y="-8.33333"
          width="41.6667"
          height="116.667"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"
          />
          <feBlend
            mode="normal"
            in2="BackgroundImageFix"
            result="effect1_dropShadow"
          />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow"
            result="shape"
          />
        </filter>
        <linearGradient
          id="paint0_linear"
          x1="6.82062"
          y1="0.874534"
          x2="45.5753"
          y2="38.2241"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="white" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Prevent unnecessary re-renders of large trees during unrelated state changes
export const TaskTree = memo(TaskTreeInner);
const TaskRunTree = memo(TaskRunTreeInner);
