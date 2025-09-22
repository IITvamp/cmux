import { TaskTree, type TaskWithRuns } from "@/components/TaskTree";
import { TaskTreeSkeleton } from "@/components/TaskTreeSkeleton";
import { useExpandTasks } from "@/contexts/expand-tasks/ExpandTasksContext";
import { isElectron } from "@/lib/electron";
import { type Doc } from "@cmux/convex/dataModel";
import type { LinkProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Home, Plus, Server } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type PropsWithChildren,
} from "react";
import CmuxLogo from "./logo/cmux-logo";
import { SidebarNavLink } from "./sidebar/SidebarNavLink";
import { SidebarPullRequestList } from "./sidebar/SidebarPullRequestList";
import { SidebarSectionLink } from "./sidebar/SidebarSectionLink";

interface SidebarProps {
  tasks: Doc<"tasks">[] | undefined;
  tasksWithRuns: TaskWithRuns[];
  teamSlugOrId: string;
}

interface SidebarNavItem {
  label: string;
  to: LinkProps["to"];
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  search?: LinkProps["search"];
  exact?: boolean;
}
const navItems: SidebarNavItem[] = [
  {
    label: "Home",
    to: "/$teamSlugOrId/dashboard",
    exact: true,
    icon: Home,
  },
  {
    label: "Environments",
    to: "/$teamSlugOrId/environments",
    search: {
      step: undefined,
      selectedRepos: undefined,
      connectionLogin: undefined,
      repoSearch: undefined,
      instanceId: undefined,
    },
    exact: true,
    icon: Server,
  },
];

export function Sidebar({ tasks, tasksWithRuns, teamSlugOrId }: SidebarProps) {
  const DEFAULT_WIDTH = 256;
  const MIN_WIDTH = 240;
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

  const { expandTaskIds } = useExpandTasks();

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
          to="/$teamSlugOrId/dashboard"
          params={{ teamSlugOrId }}
          activeOptions={{ exact: true }}
          className="flex items-center gap-2 select-none cursor-pointer"
          style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
        >
          {/* <Terminals */}
          <CmuxLogo height={32} />
        </Link>
        <div className="grow"></div>
        <Link
          to="/$teamSlugOrId/dashboard"
          params={{ teamSlugOrId }}
          activeOptions={{ exact: true }}
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
        <div className="flex-1 overflow-y-auto pb-8">
          <ul className="flex flex-col gap-px">
            {navItems.map((item) => (
              <li key={item.label}>
                <SidebarNavLink
                  to={item.to}
                  params={{ teamSlugOrId }}
                  search={item.search}
                  icon={item.icon}
                  exact={item.exact}
                  label={item.label}
                />
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-col">
            <SidebarSectionLink
              to="/$teamSlugOrId/prs"
              params={{ teamSlugOrId }}
              exact
            >
              Pull requests
            </SidebarSectionLink>
            <SmoothHeight className="ml-2 pt-px">
              <SidebarPullRequestList teamSlugOrId={teamSlugOrId} />
            </SmoothHeight>
          </div>

          <div className="mt-2 flex flex-col gap-0.5">
            <SidebarSectionLink
              to="/$teamSlugOrId/workspaces"
              params={{ teamSlugOrId }}
              exact
            >
              Workspaces
            </SidebarSectionLink>
          </div>

          <SmoothHeight className="ml-2 pt-px">
            <div className="space-y-px">
              {tasks === undefined ? (
                <TaskTreeSkeleton count={5} />
              ) : tasksWithRuns.length > 0 ? (
                tasksWithRuns.map((task) => (
                  <TaskTree
                    key={task._id}
                    task={task}
                    defaultExpanded={expandTaskIds?.includes(task._id) ?? false}
                    teamSlugOrId={teamSlugOrId}
                  />
                ))
              ) : (
                <p className="px-2 py-1.5 text-xs text-center text-neutral-500 dark:text-neutral-400 select-none">
                  No recent tasks
                </p>
              )}
            </div>
          </SmoothHeight>
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

// Smoothly animates height changes of its children using ResizeObserver and FLIP.
// This ensures all nested expand/collapse actions in the sidebar feel responsive.
function SmoothHeight({
  children,
  className,
  durationMs = 280,
  easing = "cubic-bezier(0.2, 0, 0, 1)",
}: PropsWithChildren<{
  className?: string;
  durationMs?: number;
  easing?: string;
}>) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const animatingRef = useRef(false);

  // Respect reduced motion
  const prefersReducedMotion = (() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  })();

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    // Ensure a clean base state
    outer.style.height = "auto";
    outer.style.overflow = "visible";
    outer.style.transitionProperty = "none";
    outer.style.willChange = "auto";

    if (prefersReducedMotion) {
      return;
    }

    const onTransitionEnd = (ev: TransitionEvent) => {
      if (ev.propertyName !== "height") return;
      const el = outerRef.current;
      if (!el) return;
      animatingRef.current = false;
      el.style.transitionProperty = "none";
      el.style.height = "auto";
      el.style.overflow = "visible";
      el.style.willChange = "auto";
    };

    outer.addEventListener("transitionend", onTransitionEnd);

    // Observe child size changes and animate outer height
    const ro = new ResizeObserver(() => {
      const el = outerRef.current;
      const content = innerRef.current;
      if (!el || !content) return;

      const next = content.offsetHeight;
      const rect = el.getBoundingClientRect();
      const current = Math.max(0, Math.round(rect.height));
      if (next === current) return;

      // Prepare for FLIP
      animatingRef.current = true;
      el.style.transitionProperty = "none";
      el.style.overflow = "hidden";
      el.style.willChange = "height";
      el.style.height = `${current}px`;

      // Next frame: animate to new height
      requestAnimationFrame(() => {
        const el2 = outerRef.current;
        const content2 = innerRef.current;
        if (!el2 || !content2) return;
        const newHeight = content2.offsetHeight;
        el2.style.transitionProperty = "height";
        el2.style.transitionDuration = `${durationMs}ms`;
        el2.style.transitionTimingFunction = easing;
        el2.style.height = `${newHeight}px`;
      });
    });

    ro.observe(inner);
    roRef.current = ro;

    return () => {
      outer.removeEventListener("transitionend", onTransitionEnd);
      ro.disconnect();
      roRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMs, easing, prefersReducedMotion]);

  return (
    <div ref={outerRef} className={className} style={{ contain: "layout" } as CSSProperties}>
      <div ref={innerRef}>{children}</div>
    </div>
  );
}
