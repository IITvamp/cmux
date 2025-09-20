import { useTheme } from "@/components/theme/use-theme";
import { isElectron } from "@/lib/electron";
import { copyAllElectronLogs } from "@/lib/electron-logs/electron-logs";
import { setLastTeamSlugOrId } from "@/lib/lastTeam";
import { api } from "@cmux/convex/api";
import { useUser } from "@stackframe/react";
import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Command } from "cmdk";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  ClipboardCopy,
  GitPullRequest,
  Monitor,
  Moon,
  Plus,
  ScrollText,
  Sun,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  CommandBarGroup,
  CommandBarItem,
  CommandBarStep,
} from "./command-bar/types";

interface CommandBarProps {
  teamSlugOrId: string;
}

const commandItemClassName =
  "flex items-center gap-2 px-3 py-2.5 mx-1 rounded-md cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 data-[selected=true]:bg-neutral-100 dark:data-[selected=true]:bg-neutral-800 data-[selected=true]:text-neutral-900 dark:data-[selected=true]:text-neutral-100";

const defaultPlaceholder = "Type a command or search...";

function getClientSlug(meta: unknown): string | undefined {
  if (meta && typeof meta === "object" && meta !== null) {
    const candidate = (meta as Record<string, unknown>).slug;
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return undefined;
}

export function CommandBar({ teamSlugOrId }: CommandBarProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [openedWithShift, setOpenedWithShift] = useState(false);
  const [nestedSteps, setNestedSteps] = useState<CommandBarStep[]>([]);
  const openRef = useRef<boolean>(false);
  // Used only in non-Electron fallback
  const prevFocusedElRef = useRef<HTMLElement | null>(null);

  const navigate = useNavigate();
  const router = useRouter();
  const { setTheme } = useTheme();
  const user = useUser({ or: "return-null" });
  const teams = user?.useTeams() ?? [];

  const allTasks = useQuery(api.tasks.getTasksWithTaskRuns, { teamSlugOrId });
  const teamMemberships = useQuery(api.teams.listTeamMemberships);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

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
          setNestedSteps([]);
        } else {
          setOpenedWithShift(false);
          // Capture the currently focused element before opening (web only)
          prevFocusedElRef.current =
            document.activeElement as HTMLElement | null;
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
      // Only trigger on EXACT Cmd+K (no Shift/Alt/Ctrl)
      if (
        e.key.toLowerCase() === "k" &&
        e.metaKey &&
        !e.shiftKey &&
        !e.altKey &&
        !e.ctrlKey
      ) {
        e.preventDefault();
        if (openRef.current) {
          setOpenedWithShift(false);
          setSearch("");
          setNestedSteps([]);
        } else {
          setOpenedWithShift(false);
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

  useEffect(() => {
    if (!open) {
      setSearch("");
      setNestedSteps([]);
      setOpenedWithShift(false);
    }
  }, [open]);

  const currentTeamMembership = useMemo(() => {
    if (!teamMemberships) return undefined;
    return teamMemberships.find((membership) => {
      const slug = membership.team?.slug ?? null;
      return slug === teamSlugOrId || membership.teamId === teamSlugOrId;
    });
  }, [teamMemberships, teamSlugOrId]);

  const currentTeamName = useMemo(() => {
    if (!currentTeamMembership) return undefined;
    const stackTeam = teams.find((team) => team.id === currentTeamMembership.teamId);
    return (
      stackTeam?.displayName ||
      currentTeamMembership.team?.displayName ||
      currentTeamMembership.team?.name ||
      currentTeamMembership.team?.slug ||
      stackTeam?.slug ||
      undefined
    );
  }, [currentTeamMembership, teams]);

  const rootStep = useMemo<CommandBarStep>(() => {
    const stackTeamMap = new Map(teams.map((team) => [team.id, team]));

    const actionsGroup: CommandBarGroup = {
      id: "actions",
      label: "Actions",
      items: [
        {
          kind: "step" as const,
          id: "switch-team",
          value: "action:switch-team",
          label: "Switch team",
          description: currentTeamName
            ? `Current: ${currentTeamName}`
            : undefined,
          icon: <Users className="h-4 w-4 text-neutral-500" />,
          createStep: () => {
            const memberships = teamMemberships ?? [];
            const teamItems: CommandBarItem[] = memberships.map((membership) => {
              const stackTeam = stackTeamMap.get(membership.teamId);
              const stackSlug = stackTeam?.slug;
              const metaSlug = stackTeam
                ? getClientSlug(stackTeam.clientMetadata)
                : undefined;
              const slug =
                membership.team?.slug || metaSlug || stackSlug || membership.teamId;
              const label =
                stackTeam?.displayName ||
                membership.team?.displayName ||
                membership.team?.name ||
                slug ||
                membership.teamId;
              const initial =
                label?.trim().charAt(0)?.toUpperCase() ||
                membership.teamId.charAt(0).toUpperCase();
              const targetTeamSlugOrId = slug;
              const isActive =
                targetTeamSlugOrId === teamSlugOrId ||
                membership.teamId === teamSlugOrId;

              const trailing = isActive ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                  Active
                </span>
              ) : null;

              return {
                kind: "action" as const,
                id: `switch-team-${membership.teamId}`,
                value: `switch-team:${targetTeamSlugOrId}`,
                label,
                description:
                  slug && slug !== label ? slug : membership.team?.slug ?? undefined,
                leading: (
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-200"
                    aria-hidden
                  >
                    {initial}
                  </span>
                ),
                trailing,
                onHighlight: undefined,
                onSelect: async () => {
                  const stackTeam = stackTeamMap.get(membership.teamId);
                  const selectedSlugOrId = targetTeamSlugOrId;

                  if (user && stackTeam) {
                    try {
                      await user.setSelectedTeam(stackTeam);
                    } catch (error) {
                      console.error("Failed to set selected team", error);
                    }
                  }

                  setLastTeamSlugOrId(selectedSlugOrId);

                  if (!isActive) {
                    await navigate({
                      to: "/$teamSlugOrId/dashboard",
                      params: { teamSlugOrId: selectedSlugOrId },
                    });
                  }
                },
              } satisfies CommandBarItem;
            });

            return {
              id: "switch-team-step",
              title: "Switch team",
              placeholder: "Search teams...",
              groups: [
                {
                  id: "teams",
                  label: "Teams",
                  items: teamItems,
                },
              ],
            } satisfies CommandBarStep;
          },
        },
        {
          kind: "action" as const,
          id: "new-task",
          value: "action:new-task",
          label: "New Task",
          icon: <Plus className="h-4 w-4 text-neutral-500" />,
          onSelect: async () => {
            await navigate({
              to: "/$teamSlugOrId/dashboard",
              params: { teamSlugOrId },
            });
          },
        },
        {
          kind: "action" as const,
          id: "pull-requests",
          value: "action:pull-requests",
          label: "Pull Requests",
          icon: <GitPullRequest className="h-4 w-4 text-neutral-500" />,
          onSelect: async () => {
            await navigate({
              to: "/$teamSlugOrId/prs",
              params: { teamSlugOrId },
            });
          },
        },
      ],
    } satisfies CommandBarGroup;

    const themeGroup: CommandBarGroup = {
      id: "theme",
      label: "Theme",
      items: [
        {
          kind: "action" as const,
          id: "theme-light",
          value: "theme:light",
          label: "Light Mode",
          icon: <Sun className="h-4 w-4 text-amber-500" />,
          onSelect: () => {
            setTheme("light");
          },
        },
        {
          kind: "action" as const,
          id: "theme-dark",
          value: "theme:dark",
          label: "Dark Mode",
          icon: <Moon className="h-4 w-4 text-blue-500" />,
          onSelect: () => {
            setTheme("dark");
          },
        },
        {
          kind: "action" as const,
          id: "theme-system",
          value: "theme:system",
          label: "System Theme",
          icon: <Monitor className="h-4 w-4 text-neutral-500" />,
          onSelect: () => {
            setTheme("system");
          },
        },
      ],
    } satisfies CommandBarGroup;

    const taskGroup: CommandBarGroup | null = allTasks && allTasks.length > 0
      ? {
          id: "tasks",
          label: "Tasks",
          items: allTasks.slice(0, 9).flatMap((task, index) => {
            const run = task.selectedTaskRun;
            const runId = run?._id;
            const ordinal = index + 1;
            const baseLabel = task.pullRequestTitle || task.text;
            const statusBadge = (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                task.isCompleted
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                  : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
              }`}>
                {task.isCompleted ? "completed" : "in progress"}
              </span>
            );

            const baseItem: CommandBarItem = {
              kind: "action" as const,
              id: `task:${task._id}`,
              value: `${ordinal}:task:${task._id}`,
              label: baseLabel,
              leading: (
                <span
                  className="flex h-5 w-5 items-center justify-center rounded text-xs font-semibold bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300"
                  aria-hidden
                >
                  {ordinal}
                </span>
              ),
              trailing: statusBadge,
              onHighlight: async () => {
                try {
                  await router.preloadRoute({
                    to: "/$teamSlugOrId/task/$taskId",
                    params: { teamSlugOrId, taskId: task._id },
                    search: { runId: undefined },
                  });
                } catch {
                  // ignore
                }
              },
              onSelect: async () => {
                await navigate({
                  to: "/$teamSlugOrId/task/$taskId",
                  params: { teamSlugOrId, taskId: task._id },
                  search: { runId: undefined },
                });
              },
            } satisfies CommandBarItem;

            const items: CommandBarItem[] = [baseItem];

            if (run && runId) {
              items.push({
                kind: "action" as const,
                id: `task:${task._id}:vs`,
                value: `${ordinal} vs:task:${task._id}`,
                label: baseLabel,
                leading: (
                  <span
                    className="flex h-5 w-10 items-center justify-center rounded text-xs font-semibold bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300"
                    aria-hidden
                  >
                    {ordinal} VS
                  </span>
                ),
                trailing: statusBadge,
                onHighlight: async () => {
                  try {
                    await router.preloadRoute({
                      to: "/$teamSlugOrId/task/$taskId/run/$runId/vscode",
                      params: { teamSlugOrId, taskId: task._id, runId },
                    });
                  } catch {
                    // ignore
                  }
                },
                onSelect: async () => {
                  await navigate({
                    to: "/$teamSlugOrId/task/$taskId/run/$runId/vscode",
                    params: { teamSlugOrId, taskId: task._id, runId },
                  });
                },
              });

              items.push({
                kind: "action" as const,
                id: `task:${task._id}:gitdiff`,
                value: `${ordinal} git diff:task:${task._id}`,
                label: baseLabel,
                leading: (
                  <span
                    className="flex h-5 px-2 items-center justify-center rounded text-xs font-semibold bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300"
                    aria-hidden
                  >
                    {ordinal} git diff
                  </span>
                ),
                trailing: statusBadge,
                onHighlight: async () => {
                  try {
                    await router.preloadRoute({
                      to: "/$teamSlugOrId/task/$taskId/run/$runId/diff",
                      params: { teamSlugOrId, taskId: task._id, runId },
                    });
                  } catch {
                    // ignore
                  }
                },
                onSelect: async () => {
                  await navigate({
                    to: "/$teamSlugOrId/task/$taskId/run/$runId/diff",
                    params: { teamSlugOrId, taskId: task._id, runId },
                  });
                },
              });
            }

            return items;
          }),
        }
      : null;

    const logsGroup: CommandBarGroup | null = isElectron
      ? {
          id: "logs",
          label: "Logs",
          items: [
            {
              kind: "action" as const,
              id: "logs:view",
              value: "logs:view",
              label: "Logs: View",
              icon: <ScrollText className="h-4 w-4 text-blue-500" />,
              onSelect: async () => {
                await navigate({
                  to: "/$teamSlugOrId/logs",
                  params: { teamSlugOrId },
                });
              },
            },
            {
              kind: "action" as const,
              id: "logs:copy",
              value: "logs:copy",
              label: "Logs: Copy all",
              icon: <ClipboardCopy className="h-4 w-4 text-violet-500" />,
              onSelect: async () => {
                try {
                  const ok = await copyAllElectronLogs();
                  if (ok) {
                    toast.success("Copied logs to clipboard");
                  } else {
                    toast.error("Unable to copy logs");
                  }
                } catch {
                  toast.error("Unable to copy logs");
                }
              },
            },
          ],
        }
      : null;

    const groups: CommandBarGroup[] = [actionsGroup, themeGroup];
    if (taskGroup) groups.push(taskGroup);
    if (logsGroup) groups.push(logsGroup);

    return {
      id: "root",
      title: undefined,
      placeholder: defaultPlaceholder,
      groups,
    } satisfies CommandBarStep;
  }, [
    allTasks,
    currentTeamName,
    navigate,
    router,
    setTheme,
    teamMemberships,
    teamSlugOrId,
    teams,
    user,
  ]);

  const currentStep = nestedSteps.length
    ? nestedSteps[nestedSteps.length - 1]
    : rootStep;

  const isRootStep = nestedSteps.length === 0;

  const handleBackSelect = useCallback(() => {
    setNestedSteps((steps) => steps.slice(0, -1));
    setSearch("");
  }, []);

  const groupsForRender = useMemo(() => {
    if (isRootStep) return currentStep.groups;
    const backItem: CommandBarItem = {
      kind: "action" as const,
      id: "__back",
      value: "__back",
      label: "Back",
      icon: <ArrowLeft className="h-4 w-4 text-neutral-500" />,
      onSelect: handleBackSelect,
      // Prevent closing the command bar when backing out of a step
      closeOnSelect: false,
    };
    return [
      {
        id: "__back-group",
        items: [backItem],
      },
      ...currentStep.groups,
    ];
  }, [currentStep.groups, handleBackSelect, isRootStep]);

  const renderedItemsMap = useMemo(() => {
    const map = new Map<string, CommandBarItem>();
    for (const group of groupsForRender) {
      for (const item of group.items) {
        map.set(item.value, item);
      }
    }
    return map;
  }, [groupsForRender]);

  const handleHighlight = useCallback(
    async (value: string) => {
      const item = renderedItemsMap.get(value);
      if (!item || !item.onHighlight) return;
      try {
        await item.onHighlight();
      } catch {
        // ignore highlight errors
      }
    },
    [renderedItemsMap]
  );

  const handleSelect = useCallback(
    async (value: string) => {
      const item = renderedItemsMap.get(value);
      if (!item) return;

      if (item.kind === "step") {
        const nextStep = item.createStep();
        setNestedSteps((steps) => [...steps, nextStep]);
        setSearch("");
        return;
      }

      try {
        await item.onSelect();
      } catch (error) {
        console.error("Command item selection failed", error);
      }

      const shouldClose = item.closeOnSelect ?? true;
      if (shouldClose) {
        setOpen(false);
      } else {
        setSearch("");
      }
      setOpenedWithShift(false);
    },
    [renderedItemsMap]
  );

  if (!open) return null;

  const placeholder = currentStep.placeholder ?? defaultPlaceholder;

  return (
    <>
      <div
        className="fixed inset-0 z-[var(--z-commandbar)]"
        onClick={() => {
          setOpen(false);
        }}
      />
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Command Menu"
        title="Command Menu"
        loop
        className="fixed inset-0 z-[var(--z-commandbar)] flex items-start justify-center pt-[20vh] pointer-events-none"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            if (!isRootStep) {
              e.preventDefault();
              handleBackSelect();
              return;
            }
            setOpen(false);
          }
        }}
        onValueChange={handleHighlight}
        defaultValue={openedWithShift ? "action:new-task" : undefined}
      >
        <Dialog.Title className="sr-only">Command Menu</Dialog.Title>

        <div className="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden pointer-events-auto">
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder={placeholder}
            className="w-full px-4 py-3 text-sm bg-transparent border-b border-neutral-200 dark:border-neutral-700 outline-none placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
          />

          {currentStep.title && !isRootStep ? (
            <div className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800">
              {currentStep.title}
            </div>
          ) : null}

          <Command.List className="max-h-[400px] overflow-y-auto px-1 pb-2 flex flex-col gap-2">
            <Command.Empty className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
              No results found.
            </Command.Empty>

            {groupsForRender.map((group) => {
              if (group.items.length === 0) return null;
              return (
                <Command.Group key={group.id}>
                  {group.label ? (
                    <div className="px-2 py-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                      {group.label}
                    </div>
                  ) : null}
                  {group.items.map((item) => (
                    <Command.Item
                      key={item.value}
                      value={item.value}
                      onSelect={() => handleSelect(item.value)}
                      className={commandItemClassName}
                    >
                      {item.leading
                        ? item.leading
                        : item.icon
                        ? item.icon
                        : null}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm">{item.label}</span>
                        {item.description ? (
                          <span className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                            {item.description}
                          </span>
                        ) : null}
                      </div>
                      {item.trailing ?? null}
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            })}
          </Command.List>
        </div>
      </Command.Dialog>
    </>
  );
}
