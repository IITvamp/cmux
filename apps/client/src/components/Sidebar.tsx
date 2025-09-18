import { TaskTree, type TaskWithRuns } from "@/components/TaskTree";
import { TaskTreeSkeleton } from "@/components/TaskTreeSkeleton";
import { useExpandTasks } from "@/contexts/expand-tasks/ExpandTasksContext";
import { isElectron } from "@/lib/electron";
import { type Doc } from "@cmux/convex/dataModel";
import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import { GitPullRequest, Home, Plus, Server } from "lucide-react";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import CmuxLogo from "./logo/cmux-logo";

interface SidebarProps {
  teamSlugOrId: string;
  tasks: Doc<"tasks">[] | undefined;
  tasksWithRuns: TaskWithRuns[];
}

interface SidebarNavItem {
  label: string;
  to: string;
  icon?: ReactNode;
}

const NAV_ITEM_BASE_CLASSES =
  "pointer-default cursor-default group mx-1 flex items-center gap-2 rounded-sm pl-2 ml-2 pr-3 py-0.5 text-[13px] font-medium text-neutral-700 select-none hover:bg-neutral-200/45 dark:text-neutral-300 dark:hover:bg-neutral-800/45 data-[active=true]:hover:bg-neutral-200/75 dark:data-[active=true]:hover:bg-neutral-800/65";
const NAV_ITEM_ACTIVE_CLASSES =
  "bg-neutral-200/75 text-neutral-900 dark:bg-neutral-800/65 dark:text-neutral-100";
const ICON_BASE_CLASSES =
  "size-[15px] text-neutral-500 group-hover:text-neutral-800 dark:group-hover:text-neutral-100";
const ICON_ACTIVE_CLASSES =
  "group-data-[active=true]:text-neutral-900 dark:group-data-[active=true]:text-neutral-100";
const WORKSPACES_LINK_BASE_CLASSES =
  "pointer-default cursor-default mx-1 flex items-center rounded-sm pl-2 ml-2 pr-3 py-0.5 text-[12px] font-medium text-neutral-600 select-none hover:bg-neutral-200/45 dark:text-neutral-300 dark:hover:bg-neutral-800/45";
const WORKSPACES_LINK_ACTIVE_CLASSES =
  "bg-neutral-200/75 text-neutral-900 dark:bg-neutral-800/65 dark:text-neutral-100";

export function Sidebar({ teamSlugOrId, tasks, tasksWithRuns }: SidebarProps) {
  const DEFAULT_WIDTH = 220;
  const MIN_WIDTH = 220;
  const MAX_WIDTH = 600;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerLeftRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const [width, setWidth] = useState<number>(() => {
    const stored = localStorage.getItem("sidebarWidth");
    const parsed = stored ? Number.parseInt(stored, 10) : DEFAULT_WIDTH;
    if (Number.isNaN(parsed)) return DEFAULT_WIDTH;
    return Math.min(Math.max(parsed, MIN_WIDTH), MAX_WIDTH);
  });
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    localStorage.setItem("sidebarWidth", String(width));
  }, [width]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    // Batch width updates to once per animation frame to reduce layout thrash
    if (rafIdRef.current != null) return;
    rafIdRef.current = window.requestAnimationFrame(() => {
      rafIdRef.current = null;
      const containerLeft = containerLeftRef.current;
      const clientX = e.clientX;
      const newWidth = Math.min(
        Math.max(clientX - containerLeft, MIN_WIDTH),
        MAX_WIDTH
      );
      setWidth(newWidth);
    });
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = "";
    document.body.classList.remove("select-none");
    document.body.classList.remove("cmux-sidebar-resizing");
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    // Restore iframe pointer events
    const iframes = Array.from(document.querySelectorAll("iframe"));
    for (const el of iframes) {
      if (el instanceof HTMLIFrameElement) {
        const prev = el.dataset.prevPointerEvents;
        if (prev !== undefined) {
          if (prev === "__unset__") {
            el.style.removeProperty("pointer-events");
          } else {
            el.style.pointerEvents = prev;
          }
          delete el.dataset.prevPointerEvents;
        } else {
          // Fallback to clearing
          el.style.removeProperty("pointer-events");
        }
      }
    }
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", stopResizing);
  }, [onMouseMove]);

  const startResizing = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsResizing(true);
      document.body.style.cursor = "col-resize";
      document.body.classList.add("select-none");
      document.body.classList.add("cmux-sidebar-resizing");
      // Snapshot the container's left position so we don't force layout on every move
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        containerLeftRef.current = rect.left;
      }
      // Disable pointer events on all iframes so dragging works over them
      const iframes = Array.from(document.querySelectorAll("iframe"));
      for (const el of iframes) {
        if (el instanceof HTMLIFrameElement) {
          const current = el.style.pointerEvents;
          el.dataset.prevPointerEvents = current ? current : "__unset__";
          el.style.pointerEvents = "none";
        }
      }
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", stopResizing);
    },
    [onMouseMove, stopResizing]
  );

  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [onMouseMove, stopResizing]);

  const resetWidth = useCallback(() => setWidth(DEFAULT_WIDTH), []);

  const { expandTaskIds } = useExpandTasks();

  const navItems: SidebarNavItem[] = [
    {
      label: "Home",
      to: "/$teamSlugOrId",
      icon: <Home className={clsx(ICON_BASE_CLASSES, ICON_ACTIVE_CLASSES)} />,
    },
    {
      label: "Pull requests",
      to: "/$teamSlugOrId/prs",
      icon: (
        <GitPullRequest
          className={clsx(ICON_BASE_CLASSES, ICON_ACTIVE_CLASSES)}
        />
      ),
    },
    {
      label: "Environments",
      to: "/$teamSlugOrId/environments",
      icon: <Server className={clsx(ICON_BASE_CLASSES, ICON_ACTIVE_CLASSES)} />,
    },
  ];

  return (
    <div
      ref={containerRef}
      className="relative bg-neutral-50 dark:bg-black flex flex-col shrink-0 h-dvh grow"
      style={{
        width: `${width}px`,
        minWidth: `${width}px`,
        maxWidth: `${width}px`,
        userSelect: isResizing ? ("none" as const) : undefined,
      }}
    >
      <div
        className={`h-[38px] flex items-center pr-1.5 shrink-0 ${isElectron ? "" : "pl-3"}`}
        style={{ WebkitAppRegion: "drag" } as CSSProperties}
      >
        {isElectron && <div className="w-[80px]"></div>}
        <Link
          to="/$teamSlugOrId"
          params={{ teamSlugOrId }}
          className="flex items-center gap-2 select-none cursor-pointer"
          style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
        >
          {/* <Terminals */}
          <CmuxLogo height={32} />
        </Link>
        <div className="grow"></div>
        <Link
          to="/$teamSlugOrId"
          params={{ teamSlugOrId }}
          className="w-[25px] h-[25px] border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-lg flex items-center justify-center transition-colors cursor-default"
          title="New task"
          style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
        >
          <Plus
            className="w-4 h-4 text-neutral-700 dark:text-neutral-300"
            aria-hidden="true"
          />
        </Link>
      </div>
      <nav className="grow flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto py-1">
          <ul className="flex flex-col gap-0.5">
            {navItems.map((item) => (
              <li key={item.label}>
                <Link
                  to={item.to}
                  params={{ teamSlugOrId }}
                  activeOptions={{ exact: true }}
                  className={clsx(NAV_ITEM_BASE_CLASSES)}
                  activeProps={{
                    className: clsx(
                      NAV_ITEM_BASE_CLASSES,
                      NAV_ITEM_ACTIVE_CLASSES
                    ),
                    "data-active": "true",
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-col gap-0.5">
            <Link
              to="/$teamSlugOrId/workspaces"
              params={{ teamSlugOrId }}
              activeOptions={{ exact: true }}
              className={WORKSPACES_LINK_BASE_CLASSES}
              activeProps={{
                className: clsx(
                  WORKSPACES_LINK_BASE_CLASSES,
                  WORKSPACES_LINK_ACTIVE_CLASSES
                ),
                "data-active": "true",
              }}
            >
              <span className="capitalize">Workspaces</span>
            </Link>
          </div>
          <div className="px-2 pb-2">
            {tasks === undefined ? (
              <TaskTreeSkeleton count={5} />
            ) : tasksWithRuns.length > 0 ? (
              <div className="space-y-0.5">
                {tasksWithRuns.map((task) => (
                  <TaskTree
                    key={task._id}
                    task={task}
                    defaultExpanded={expandTaskIds?.includes(task._id) ?? false}
                    teamSlugOrId={teamSlugOrId}
                  />
                ))}
              </div>
            ) : (
              <p className="px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400 select-none">
                No workspaces yet
              </p>
            )}
          </div>
        </div>
      </nav>

      {/* Resize handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        title="Drag to resize"
        onMouseDown={startResizing}
        onDoubleClick={resetWidth}
        className="absolute top-0 right-0 h-full cursor-col-resize"
        style={
          {
            // Invisible, but with a comfortable hit area
            width: "14px",
            transform: "translateX(13px)",
            // marginRight: "-5px",
            background: "transparent",
            // background: "red",
            zIndex: "var(--z-sidebar-resize-handle)",
          } as CSSProperties
        }
      />
    </div>
  );
}
