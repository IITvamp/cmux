import * as React from "react";
import { useTheme } from "@/components/theme/use-theme";
import { api } from "@cmux/convex/api";
import * as Dialog from "@radix-ui/react-dialog";

import { isElectron } from "@/lib/electron";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Command } from "cmdk";
import { useMutation, useQuery } from "convex/react";
import { GitPullRequest, Monitor, Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface CommandBarProps {
  teamSlugOrId: string;
}

export function CommandBar({ teamSlugOrId }: CommandBarProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [openedWithShift, setOpenedWithShift] = useState(false);
  const openRef = useRef<boolean>(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  // Used only in non-Electron fallback
  const prevFocusedElRef = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();
  const router = useRouter();
  const { setTheme } = useTheme();

  const allTasks = useQuery(api.tasks.get, { teamSlugOrId });
  const createRun = useMutation(api.taskRuns.create);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  type Position = { x: number; y: number };
  const STORAGE_KEY = "cmux:cmdk:position";
  const [position, setPosition] = useState<Position | null>(null);
  const dragState = useRef<
    | {
        startX: number;
        startY: number;
        originX: number;
        originY: number;
        width: number;
        height: number;
      }
    | null
  >(null);

  const clampToViewport = useCallback(
    (x: number, y: number, width: number, height: number): Position => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const margin = 32; // keep at least 32px visible both sides
      const minX = margin - width;
      const maxX = vw - margin;
      const minY = margin - height;
      const maxY = vh - margin;
      const clampedX = Math.min(Math.max(x, minX), maxX);
      const clampedY = Math.min(Math.max(y, minY), maxY);
      return { x: clampedX, y: clampedY };
    },
    []
  );

  // Initialize or restore position on open
  useEffect(() => {
    if (!open) return;
    const el = panelRef.current;
    const savedRaw = localStorage.getItem(STORAGE_KEY);
    const initialize = () => {
      const rect = el?.getBoundingClientRect();
      if (!rect) return;
      if (savedRaw) {
        try {
          const saved = JSON.parse(savedRaw) as Position;
          const clamped = clampToViewport(saved.x, saved.y, rect.width, rect.height);
          setPosition(clamped);
          return;
        } catch {
          // ignore malformed
        }
      }
      // Default: horizontally centered, 20vh from top
      const defaultX = Math.round(window.innerWidth / 2 - rect.width / 2);
      const defaultY = Math.round(window.innerHeight * 0.2);
      const clamped = clampToViewport(defaultX, defaultY, rect.width, rect.height);
      setPosition(clamped);
    };

    // Defer to next frame to ensure layout is ready
    const id = window.requestAnimationFrame(initialize);
    return () => window.cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Re-clamp on resize while open
  useEffect(() => {
    if (!open) return;
    const handler = () => {
      const rect = panelRef.current?.getBoundingClientRect();
      if (!rect || !position) return;
      setPosition(clampToViewport(position.x, position.y, rect.width, rect.height));
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [open, position, clampToViewport]);

  const onPointerDownHandle = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // only left button
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    const current = position ?? { x: Math.round(rect.left), y: Math.round(rect.top) };
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: current.x,
      originY: current.y,
      width: rect.width,
      height: rect.height,
    };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [position]);

  // Global pointer move/up listeners while dragging
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragState.current) return;
      const { startX, startY, originX, originY, width, height } = dragState.current;
      const next = clampToViewport(originX + (e.clientX - startX), originY + (e.clientY - startY), width, height);
      setPosition(next);
    };
    const onUp = () => {
      if (!dragState.current || !panelRef.current || !position) {
        dragState.current = null;
        return;
      }
      dragState.current = null;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
      } catch {
        // ignore storage errors
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [position, clampToViewport]);

  useEffect(() => {
    // In Electron, prefer global shortcut from main via cmux event.
    if (isElectron) {
      const off = window.cmux.on("shortcut:cmd-k", () => {
        // Only handle Cmd+K (no shift/ctrl variations)
        setOpenedWithShift(false);
        if (openRef.current) {
          // About to CLOSE via toggle: normalize state like Esc path
          setSearch("");
          setOpenedWithShift(false);
        }
        setOpen((cur) => !cur);
      });
      return () => {
        // Unsubscribe if available
        if (typeof off === "function") off();
      };
    }

    // Web/non-Electron fallback: local keydown listener for Cmd+K
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && e.metaKey) {
        e.preventDefault();
        if (openRef.current) {
          setOpenedWithShift(false);
          setSearch("");
        } else {
          setOpenedWithShift(e.shiftKey);
          // Capture the currently focused element before opening (web only)
          prevFocusedElRef.current =
            document.activeElement as HTMLElement | null;
        }
        setOpen((cur) => !cur);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Track and restore focus across open/close, including iframes/webviews.
  useEffect(() => {
    // Inform Electron main about palette open state to gate focus capture
    if (isElectron && window.cmux?.ui?.setCommandPaletteOpen) {
      void window.cmux.ui.setCommandPaletteOpen(open);
    }

    if (!open) {
      if (isElectron && window.cmux?.ui?.restoreLastFocus) {
        // Ask main to restore using stored info for this window
        void window.cmux.ui.restoreLastFocus();
      } else {
        // Web-only fallback: restore previously focused element in same doc
        const el = prevFocusedElRef.current;
        if (el) {
          const id = window.setTimeout(() => {
            try {
              el.focus({ preventScroll: true });
              if ((el as HTMLIFrameElement).tagName === "IFRAME") {
                try {
                  (el as HTMLIFrameElement).contentWindow?.focus?.();
                } catch {
                  // ignore
                }
              }
            } catch {
              // ignore
            }
          }, 0);
          return () => window.clearTimeout(id);
        }
      }
    }
    return undefined;
  }, [open]);

  const handleHighlight = useCallback(
    async (value: string) => {
      if (value?.startsWith("task:")) {
        const parts = value.slice(5).split(":");
        const taskId = parts[0];
        const action = parts[1];

        try {
          if (!action) {
            // Preload main task route
            await router.preloadRoute({
              to: "/$teamSlugOrId/task/$taskId",
              // @ts-expect-error - taskId from string
              params: { teamSlugOrId, taskId },
            });
          } else if (action === "vs") {
            // Preload VS Code route (will need a runId when actually navigating)
            await router.preloadRoute({
              to: "/$teamSlugOrId/task/$taskId",
              // @ts-expect-error - taskId from string
              params: { teamSlugOrId, taskId },
            });
          } else if (action === "gitdiff") {
            // Preload git diff route (will need a runId when actually navigating)
            await router.preloadRoute({
              to: "/$teamSlugOrId/task/$taskId",
              // @ts-expect-error - taskId from string
              params: { teamSlugOrId, taskId },
            });
          }
        } catch {
          // Silently fail preloading
        }
      }
    },
    [router, teamSlugOrId]
  );

  const handleSelect = useCallback(
    async (value: string) => {
      if (value === "new-task") {
        navigate({
          to: "/$teamSlugOrId/dashboard",
          params: { teamSlugOrId },
        });
      } else if (value === "pull-requests") {
        navigate({
          to: "/$teamSlugOrId/prs",
          params: { teamSlugOrId },
        });
      } else if (value === "theme-light") {
        setTheme("light");
      } else if (value === "theme-dark") {
        setTheme("dark");
      } else if (value === "theme-system") {
        setTheme("system");
      } else if (value.startsWith("task:")) {
        const parts = value.slice(5).split(":");
        const taskId = parts[0];
        const action = parts[1];

        if (action === "vs" || action === "gitdiff") {
          try {
            // Create a new run for VS Code or git diff
            const runId = await createRun({
              teamSlugOrId,
              // @ts-expect-error - taskId from string
              taskId,
              prompt: action === "vs" ? "Opening VS Code" : "Viewing git diff",
            });

            if (runId) {
              if (action === "vs") {
                navigate({
                  to: "/$teamSlugOrId/task/$taskId/run/$runId/vscode",
                  // @ts-expect-error - taskId and runId extracted from string
                  params: { teamSlugOrId, taskId, runId },
                });
              } else {
                navigate({
                  to: "/$teamSlugOrId/task/$taskId/run/$runId/diff",
                  // @ts-expect-error - taskId and runId extracted from string
                  params: { teamSlugOrId, taskId, runId },
                });
              }
            }
          } catch (_error) {
            toast.error("Failed to create run");
            navigate({
              to: "/$teamSlugOrId/task/$taskId",
              // @ts-expect-error - taskId extracted from string
              params: { teamSlugOrId, taskId },
              search: { runId: undefined },
            });
          }
        } else {
          navigate({
            to: "/$teamSlugOrId/task/$taskId",
            // @ts-expect-error - taskId extracted from string
            params: { teamSlugOrId, taskId },
            search: { runId: undefined },
          });
        }
      }
      setOpen(false);
      setSearch("");
      setOpenedWithShift(false);
    },
    [navigate, teamSlugOrId, setTheme, createRun]
  );

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[var(--z-commandbar)]"
        onClick={() => {
          setOpen(false);
          setSearch("");
          setOpenedWithShift(false);
        }}
      />
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Command Menu"
        title="Command Menu"
        loop
        className="fixed inset-0 z-[var(--z-commandbar)] pointer-events-none"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setSearch("");
            setOpenedWithShift(false);
          }
        }}
        onValueChange={handleHighlight}
        defaultValue={openedWithShift ? "new-task" : undefined}
      >
        <Dialog.Title className="sr-only">Command Menu</Dialog.Title>

        <div
          ref={panelRef}
          className="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden pointer-events-auto"
          style={
            position
              ? { position: "fixed", left: position.x, top: position.y }
              : { position: "fixed", left: "50%", top: "20vh", transform: "translateX(-50%)" }
          }
          onPointerDown={(e) => {
            // Prevent underlying overlay click when starting a drag in empty areas
            e.stopPropagation();
          }}
        >
          <div
            role="button"
            aria-label="Drag command bar"
            tabIndex={-1}
            onPointerDown={onPointerDownHandle}
            className="h-3 cursor-move active:cursor-grabbing select-none bg-transparent"
          />
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Type a command or search..."
            className="w-full px-4 py-3 text-sm bg-transparent border-b border-neutral-200 dark:border-neutral-700 outline-none placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
          />
          <Command.List className="max-h-[400px] overflow-y-auto px-1 pb-2 flex flex-col gap-2">
            <Command.Empty className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
              No results found.
            </Command.Empty>

            <Command.Group>
              <div className="px-2 py-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                Actions
              </div>
              <Command.Item
                value="new-task"
                onSelect={() => handleSelect("new-task")}
                className="flex items-center gap-2 px-3 py-2.5 mx-1 rounded-md cursor-pointer
                hover:bg-neutral-100 dark:hover:bg-neutral-800
                data-[selected=true]:bg-neutral-100 dark:data-[selected=true]:bg-neutral-800
                data-[selected=true]:text-neutral-900 dark:data-[selected=true]:text-neutral-100"
              >
                <span className="text-sm">New Task</span>
              </Command.Item>
              <Command.Item
                value="pull-requests"
                onSelect={() => handleSelect("pull-requests")}
                className="flex items-center gap-2 px-3 py-2.5 mx-1 rounded-md cursor-pointer
                hover:bg-neutral-100 dark:hover:bg-neutral-800
                data-[selected=true]:bg-neutral-100 dark:data-[selected=true]:bg-neutral-800
                data-[selected=true]:text-neutral-900 dark:data-[selected=true]:text-neutral-100"
              >
                <GitPullRequest className="h-4 w-4 text-neutral-500" />
                <span className="text-sm">Pull Requests</span>
              </Command.Item>
            </Command.Group>

            <Command.Group>
              <div className="px-2 py-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                Theme
              </div>
              <Command.Item
                value="theme-light"
                onSelect={() => handleSelect("theme-light")}
                className="flex items-center gap-2 px-3 py-2.5 mx-1 rounded-md cursor-pointer                 hover:bg-neutral-100 dark:hover:bg-neutral-800 
                data-[selected=true]:bg-neutral-100 dark:data-[selected=true]:bg-neutral-800
                data-[selected=true]:text-neutral-900 dark:data-[selected=true]:text-neutral-100"
              >
                <Sun className="h-4 w-4 text-amber-500" />
                <span className="text-sm">Light Mode</span>
              </Command.Item>
              <Command.Item
                value="theme-dark"
                onSelect={() => handleSelect("theme-dark")}
                className="flex items-center gap-2 px-3 py-2.5 mx-1 rounded-md cursor-pointer                 hover:bg-neutral-100 dark:hover:bg-neutral-800 
                data-[selected=true]:bg-neutral-100 dark:data-[selected=true]:bg-neutral-800
                data-[selected=true]:text-neutral-900 dark:data-[selected=true]:text-neutral-100"
              >
                <Moon className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Dark Mode</span>
              </Command.Item>
              <Command.Item
                value="theme-system"
                onSelect={() => handleSelect("theme-system")}
                className="flex items-center gap-2 px-3 py-2.5 mx-1 rounded-md cursor-pointer                 hover:bg-neutral-100 dark:hover:bg-neutral-800 
                data-[selected=true]:bg-neutral-100 dark:data-[selected=true]:bg-neutral-800
                data-[selected=true]:text-neutral-900 dark:data-[selected=true]:text-neutral-100"
              >
                <Monitor className="h-4 w-4 text-neutral-500" />
                <span className="text-sm">System Theme</span>
              </Command.Item>
            </Command.Group>

            {allTasks && allTasks.length > 0 && (
              <Command.Group>
                <div className="px-2 py-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  Tasks
                </div>
                {allTasks.slice(0, 9).flatMap((task, index) => [
                  <Command.Item
                    key={task._id}
                    value={`${index + 1}:task:${task._id}`}
                    onSelect={() => handleSelect(`task:${task._id}`)}
                    data-value={`task:${task._id}`}
                    className="flex items-center gap-3 px-3 py-2.5 mx-1 rounded-md cursor-pointer                     hover:bg-neutral-100 dark:hover:bg-neutral-800 
                    data-[selected=true]:bg-neutral-100 dark:data-[selected=true]:bg-neutral-800
                    data-[selected=true]:text-neutral-900 dark:data-[selected=true]:text-neutral-100
                    group"
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded text-xs font-semibold
                    bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300
                    group-data-[selected=true]:bg-neutral-300 dark:group-data-[selected=true]:bg-neutral-600"
                    >
                      {index + 1}
                    </span>
                    <span className="flex-1 truncate text-sm">
                      {task.pullRequestTitle || task.text}
                    </span>
                    {task.isCompleted ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                        completed
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                        in progress
                      </span>
                    )}
                  </Command.Item>,
                  <Command.Item
                    key={`${task._id}-vs`}
                    value={`${index + 1} vs:task:${task._id}`}
                    onSelect={() => handleSelect(`task:${task._id}:vs`)}
                    data-value={`task:${task._id}:vs`}
                    className="flex items-center gap-3 px-3 py-2.5 mx-1 rounded-md cursor-pointer                     hover:bg-neutral-100 dark:hover:bg-neutral-800 
                    data-[selected=true]:bg-neutral-100 dark:data-[selected=true]:bg-neutral-800
                    data-[selected=true]:text-neutral-900 dark:data-[selected=true]:text-neutral-100
                    group"
                  >
                    <span
                      className="flex h-5 w-8 items-center justify-center rounded text-xs font-semibold
                    bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300
                    group-data-[selected=true]:bg-neutral-300 dark:group-data-[selected=true]:bg-neutral-600"
                    >
                      {index + 1} VS
                    </span>
                    <span className="flex-1 truncate text-sm">
                      {task.pullRequestTitle || task.text}
                    </span>
                    {task.isCompleted ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                        completed
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                        in progress
                      </span>
                    )}
                  </Command.Item>,
                  <Command.Item
                    key={`${task._id}-gitdiff`}
                    value={`${index + 1} git diff:task:${task._id}`}
                    onSelect={() => handleSelect(`task:${task._id}:gitdiff`)}
                    data-value={`task:${task._id}:gitdiff`}
                    className="flex items-center gap-3 px-3 py-2.5 mx-1 rounded-md cursor-pointer                     hover:bg-neutral-100 dark:hover:bg-neutral-800 
                    data-[selected=true]:bg-neutral-100 dark:data-[selected=true]:bg-neutral-800
                    data-[selected=true]:text-neutral-900 dark:data-[selected=true]:text-neutral-100
                    group"
                  >
                    <span
                      className="flex h-5 px-2 items-center justify-center rounded text-xs font-semibold
                    bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300
                    group-data-[selected=true]:bg-neutral-300 dark:group-data-[selected=true]:bg-neutral-600"
                    >
                      {index + 1} git diff
                    </span>
                    <span className="flex-1 truncate text-sm">
                      {task.pullRequestTitle || task.text}
                    </span>
                    {task.isCompleted ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                        completed
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                        in progress
                      </span>
                    )}
                  </Command.Item>,
                ])}
              </Command.Group>
            )}
          </Command.List>
        </div>
      </Command.Dialog>
    </>
  );
}
